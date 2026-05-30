import { prisma } from "@/lib/prisma";
import {
  computeCancellationRefundBreakdown,
  paymentStatusAfterCancellationRefund,
} from "@/lib/booking-cancellation-refund";
import { executeCancellationRefundByPaymentMethod } from "@/lib/booking-refund-executor";
import {
  computeCancellationDeductedDays,
  hoursBeforePickup,
  type CancellationDeductTier,
} from "@/lib/cancellation-deduct";
import { bookingPaymentMethodLabelAr } from "@/lib/booking-payment-method-label";
import { resolveBookingRentalPricePerDayExclTax } from "@/lib/booking-pricing-snapshot";
import {
  getCustomerCancelMinHoursBeforePickup,
  getCustomerCancellationDeductTiers,
} from "@/lib/site-settings";
import { customerOwnsBooking } from "@/lib/customer-booking-access";

export type CancelBookingWithPolicyResult =
  | {
      ok: true;
      refundInclTaxSar?: number;
      paymentMethod?: string | null;
      deductDays: number;
    }
  | { ok: false; error: string };

const TERMINAL_STATUSES = new Set(["CANCELLED", "REJECTED"]);

type CancelRole = "customer" | "admin";

async function loadBookingForCancel(bookingRequestId: number) {
  return prisma.bookingRequest.findUnique({
    where: { id: bookingRequestId },
    select: {
      id: true,
      status: true,
      pickupDate: true,
      numberOfDays: true,
      kind: true,
      paymentStatus: true,
      paymentMethod: true,
      addonsJson: true,
      customerId: true,
      phone: true,
      carModel: { select: { price: true, vatRatePercent: true } },
    },
  });
}

function checkCustomerCancelDeadline(pickupDate: Date, minHours: number): string | null {
  if (minHours <= 0) return null;
  const now = new Date();
  if (pickupDate.getTime() <= now.getTime()) return null;
  const lastMs = pickupDate.getTime() - minHours * 60 * 60 * 1000;
  if (now.getTime() >= lastMs) {
    return `انتهت مهلة الإلغاء. يجب إلغاء الحجز قبل موعد الاستلام بما لا يقل عن ${minHours} ساعة. للاستفسار تواصل معنا.`;
  }
  return null;
}

/**
 * إلغاء حجز مع سياسة الخصم والاسترداد (مشترك بين العميل والإدارة).
 * الإدارة تتجاوز مهلة الإلغاء للعميل فقط؛ شرائح الخصم والاسترداد تُحسب بنفس المنطق.
 */
export async function cancelBookingWithPolicy(input: {
  bookingRequestId: number;
  role: CancelRole;
  customerId?: number;
  customerPhone?: string | null;
}): Promise<CancelBookingWithPolicyResult> {
  const row = await loadBookingForCancel(input.bookingRequestId);
  if (!row) {
    return { ok: false, error: "الطلب غير موجود." };
  }

  if (input.role === "customer") {
    if (input.customerId == null) {
      return { ok: false, error: "يجب تسجيل الدخول." };
    }
    if (
      !customerOwnsBooking(row, input.customerId, input.customerPhone ?? null)
    ) {
      return { ok: false, error: "الطلب غير موجود أو لا يخص حسابك." };
    }
  }

  const st = row.status.trim().toUpperCase();
  if (st === "CANCELLED") {
    return { ok: false, error: "الطلب ملغى بالفعل." };
  }
  if (TERMINAL_STATUSES.has(st)) {
    return { ok: false, error: "لا يمكن إلغاء طلب في هذه الحالة." };
  }

  if (input.role === "customer") {
    const minHours = await getCustomerCancelMinHoursBeforePickup();
    const deadlineErr = checkCustomerCancelDeadline(row.pickupDate, minHours);
    if (deadlineErr) return { ok: false, error: deadlineErr };
  }

  const tiers = await getCustomerCancellationDeductTiers();
  const nowCancel = new Date();
  const hoursBefore = hoursBeforePickup(row.pickupDate, nowCancel);
  const deductDays = computeCancellationDeductedDays(
    hoursBefore,
    tiers,
    row.numberOfDays,
  );

  const baseData = {
    status: "CANCELLED" as const,
    cancelledAt: nowCancel,
    cancellationDeductedDays: deductDays > 0 ? deductDays : null,
  };

  let refundInclTaxSar: number | undefined;
  let paymentMethodOut: string | null | undefined;

  const ps = row.paymentStatus.trim().toUpperCase();
  const paidEligible =
    row.kind === "DIRECT" && ps === "PAID" && row.carModel != null;

  let paymentPatch: {
    paymentStatus?: string;
    cancellationRefundAmountSar?: number | null;
    cancellationRefundExternalRef?: string | null;
  } = {};

  if (paidEligible && row.carModel) {
    const br = computeCancellationRefundBreakdown({
      numberOfDays: row.numberOfDays,
      deductDays,
      pricePerDayExclTax: resolveBookingRentalPricePerDayExclTax(
        row.carModel.price,
        row.addonsJson,
      ),
      vatRatePercent: row.carModel.vatRatePercent,
      addonsJson: row.addonsJson,
    });
    if (br) {
      const exec = await executeCancellationRefundByPaymentMethod({
        bookingRequestId: row.id,
        paymentMethod: row.paymentMethod,
        refundAmountInclTaxSar: br.refundInclTax,
      });
      if (exec.ok) {
        paymentPatch = {
          paymentStatus: paymentStatusAfterCancellationRefund(
            br.paidTotalInclTax,
            br.refundInclTax,
          ),
          cancellationRefundAmountSar: br.refundInclTax,
          cancellationRefundExternalRef: exec.externalRef,
        };
        refundInclTaxSar = br.refundInclTax;
        paymentMethodOut = row.paymentMethod;
      } else {
        console.error("[cancelBookingWithPolicy] refund failed:", exec.error);
      }
    }
  }

  await prisma.bookingRequest.update({
    where: { id: row.id },
    data: {
      ...baseData,
      ...paymentPatch,
    },
  });

  return {
    ok: true,
    refundInclTaxSar,
    paymentMethod: paymentMethodOut,
    deductDays,
  };
}

export type CancellationFinancePreview = {
  paidInclTax: number;
  refundInclTax: number;
  methodLabel: string;
};

export function buildCancellationFinancePreview(input: {
  kind: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  numberOfDays: number;
  pickupDate: Date;
  pricePerDayExclTax: number | null;
  vatRatePercent: number | null;
  addonsJson: string | null;
  tiers: CancellationDeductTier[];
}): CancellationFinancePreview | null {
  const bookingSt = input.status.trim().toUpperCase();
  if (bookingSt === "CANCELLED" || bookingSt === "REJECTED") return null;
  if (input.kind !== "DIRECT") return null;
  if (input.paymentStatus.trim().toUpperCase() !== "PAID") return null;
  if (input.pricePerDayExclTax == null || input.vatRatePercent == null) return null;

  const h = hoursBeforePickup(input.pickupDate, new Date());
  const deduct = computeCancellationDeductedDays(h, input.tiers, input.numberOfDays);
  const br = computeCancellationRefundBreakdown({
    numberOfDays: input.numberOfDays,
    deductDays: deduct,
    pricePerDayExclTax: input.pricePerDayExclTax,
    vatRatePercent: input.vatRatePercent,
    addonsJson: input.addonsJson,
  });
  if (!br) return null;

  return {
    paidInclTax: br.paidTotalInclTax,
    refundInclTax: br.refundInclTax,
    methodLabel: bookingPaymentMethodLabelAr(input.paymentMethod),
  };
}
