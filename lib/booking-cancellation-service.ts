import { prisma } from "@/lib/prisma";
import { currentRequestMeta, logActivity } from "@/lib/activity-log";
import {
  computeCancellationRefundBreakdown,
  paymentStatusAfterCancellationRefund,
} from "@/lib/booking-cancellation-refund";
import { executeCancellationRefundByPaymentMethod } from "@/lib/booking-refund-executor";
import {
  BOOKING_STATUS_PICKED_UP,
  BOOKING_STATUS_RETURNED,
  hasBookingPickupPassed,
} from "@/lib/booking-lifecycle";
import {
  computeCancellationDeductedDays,
  computePickedUpCancellationDeductDays,
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
import { recordPaymentTransaction } from "@/lib/payment-transaction";

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
      paidAmountSar: true,
      balanceDueAtBranchSar: true,
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
  if (st === BOOKING_STATUS_RETURNED) {
    return { ok: false, error: "لا يمكن إلغاء حجز تم إرجاع السيارة فيه بالفعل." };
  }
  const isPickedUp = st === BOOKING_STATUS_PICKED_UP;
  if (isPickedUp && input.role === "customer") {
    return {
      ok: false,
      error: "لا يمكن للعميل إلغاء حجز تم تسليم السيارة فيه بالفعل. يرجى التواصل مع الدعم.",
    };
  }

  if (input.role === "customer") {
    // بدأ موعد الاستلام (أو مرّ بالكامل) — لا يُسمح للعميل بإلغاء ذاتي بعد هذه اللحظة
    // بصرف النظر عن حالة الطلب الحالية في النظام.
    if (hasBookingPickupPassed(row.pickupDate)) {
      return {
        ok: false,
        error: "بدأ موعد استلام هذا الحجز، لا يمكن إلغاؤه ذاتياً. يرجى التواصل مع الدعم.",
      };
    }
    const minHours = await getCustomerCancelMinHoursBeforePickup();
    const deadlineErr = checkCustomerCancelDeadline(row.pickupDate, minHours);
    if (deadlineErr) return { ok: false, error: deadlineErr };
  }

  const tiers = await getCustomerCancellationDeductTiers();
  const nowCancel = new Date();

  const deductDays = isPickedUp
    ? computePickedUpCancellationDeductDays(row.pickupDate, row.numberOfDays, tiers, nowCancel)
    : computeCancellationDeductedDays(
        hoursBeforePickup(row.pickupDate, nowCancel),
        tiers,
        row.numberOfDays,
      );

  const baseData = {
    status: "CANCELLED" as const,
    cancelledAt: nowCancel,
    cancellationDeductedDays: deductDays > 0 ? deductDays : null,
  };

  // مطالبة ذرّية بالإلغاء (compare-and-swap على الحالة): يمرّ طلب واحد فقط،
  // فلا يُنفَّذ الاسترداد مرتين عند وصول طلبَي إلغاء متزامنين.
  const claim = await prisma.bookingRequest.updateMany({
    where: {
      id: row.id,
      status: { notIn: ["CANCELLED", "REJECTED", BOOKING_STATUS_RETURNED] },
    },
    data: baseData,
  });
  if (claim.count === 0) {
    return { ok: false, error: "الطلب ملغى بالفعل أو في حالة لا تسمح بالإلغاء." };
  }

  let refundInclTaxSar: number | undefined;
  let paymentMethodOut: string | null | undefined;

  const ps = row.paymentStatus.trim().toUpperCase();
  const paidEligible =
    row.kind === "DIRECT" && ps === "PAID" && row.carModel != null;

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
      retainOneTimeFeesFully: isPickedUp,
    });
    if (br) {
      const exec = await executeCancellationRefundByPaymentMethod({
        bookingRequestId: row.id,
        paymentMethod: row.paymentMethod,
        refundAmountInclTaxSar: br.refundInclTax,
      });
      if (!exec.ok) {
        // فشل الاسترداد عبر البوابة: نتراجع عن الإلغاء حتى لا يبقى الحجز ملغى
        // بلا استرداد بصمت، ونُبلغ المستخدم صراحةً ليعيد المحاولة أو يتواصل معنا.
        console.error("[cancelBookingWithPolicy] refund failed:", exec.error);
        await prisma.bookingRequest.update({
          where: { id: row.id },
          data: {
            status: row.status,
            cancelledAt: null,
            cancellationDeductedDays: null,
          },
        });
        return {
          ok: false,
          error:
            "تعذّر تنفيذ الاسترداد عبر بوابة الدفع، ولم يتم إلغاء الحجز. يرجى المحاولة لاحقاً أو التواصل مع الدعم.",
        };
      }
      // تحديث حالة الاسترداد + سطر REFUND في الدفتر ذرّياً.
      await prisma.$transaction(async (tx) => {
        await tx.bookingRequest.update({
          where: { id: row.id },
          data: {
            paymentStatus: paymentStatusAfterCancellationRefund(
              br.paidTotalInclTax,
              br.refundInclTax,
            ),
            cancellationRefundAmountSar: br.refundInclTax,
            cancellationRefundExternalRef: exec.externalRef,
          },
        });
        if (br.refundInclTax > 0) {
          await recordPaymentTransaction(
            {
              bookingId: row.id,
              kind: "REFUND",
              amountSar: br.refundInclTax,
              method: row.paymentMethod,
              actorKind: input.role === "admin" ? "ADMIN" : "CUSTOMER",
              externalRef: exec.externalRef,
              notes: "استرداد إلغاء (سياسة الشرائح)",
            },
            tx,
          );
        }
      });
      refundInclTaxSar = br.refundInclTax;
      paymentMethodOut = row.paymentMethod;

      const meta = await currentRequestMeta();
      await logActivity({
        kind: "BOOKING_REFUND",
        path: `/admin/bookings/${row.id}`,
        actorLabel: `${
          input.role === "admin" ? "الإدارة" : "العميل"
        } — استرداد إلغاء ${br.refundInclTax} ر.س`,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
    }
  }

  return {
    ok: true,
    refundInclTaxSar,
    paymentMethod: paymentMethodOut,
    deductDays,
  };
}

export type CancelBookingFullRefundResult =
  | { ok: true; refundInclTaxSar: number; paymentMethod: string | null }
  | { ok: false; error: string };

/** قناة الاسترداد الكامل: نفس وسيلة الدفع الأصلية (بوابة) أو نقداً في الفرع. */
export type FullRefundChannel = "ORIGINAL" | "CASH";

/**
 * إلغاء إداري باسترداد كامل — يتجاوز شرائح خصم السياسة كاملةً (لا خصم أيام)
 * ويردّ كل المبلغ المدفوع. يُستخدم في حالات استثنائية (مثال: عدم توفر السيارة)
 * ويتطلب سبباً إلزامياً يُسجَّل على الحجز وفي سجل النشاط.
 * قناة الاسترداد يختارها الموظف: عبر نفس وسيلة الدفع (بوابة) أو نقداً في الفرع.
 */
export async function cancelBookingWithFullRefundByAdmin(input: {
  bookingRequestId: number;
  reasonAr: string;
  actorLabel: string;
  refundChannel?: FullRefundChannel;
}): Promise<CancelBookingFullRefundResult> {
  const reason = input.reasonAr.trim();
  if (!reason) {
    return { ok: false, error: "سبب الاسترداد إلزامي." };
  }

  const row = await loadBookingForCancel(input.bookingRequestId);
  if (!row) {
    return { ok: false, error: "الطلب غير موجود." };
  }

  const st = row.status.trim().toUpperCase();
  if (st === "CANCELLED") {
    return { ok: false, error: "الطلب ملغى بالفعل." };
  }
  if (TERMINAL_STATUSES.has(st)) {
    return { ok: false, error: "لا يمكن إلغاء طلب في هذه الحالة." };
  }
  if (st === BOOKING_STATUS_RETURNED) {
    return { ok: false, error: "لا يمكن إلغاء حجز تم إرجاع السيارة فيه بالفعل." };
  }

  const nowCancel = new Date();
  const baseData = {
    status: "CANCELLED" as const,
    cancelledAt: nowCancel,
    // لا خصم أيام — استرداد كامل بلا تطبيق سياسة الشرائح.
    cancellationDeductedDays: null,
    cancellationReasonAr: reason,
    // إلغاء الحجز بالكامل يُسقط أي رصيد كان مستحقاً على العميل (فرق تمديد مثلاً).
    balanceDueAtBranchSar: 0,
  };

  // مطالبة ذرّية بالإلغاء — طلب واحد فقط يمرّ، يمنع الاسترداد المزدوج.
  const claim = await prisma.bookingRequest.updateMany({
    where: {
      id: row.id,
      status: { notIn: ["CANCELLED", "REJECTED", BOOKING_STATUS_RETURNED] },
    },
    data: baseData,
  });
  if (claim.count === 0) {
    return { ok: false, error: "الطلب ملغى بالفعل أو في حالة لا تسمح بالإلغاء." };
  }

  const ps = row.paymentStatus.trim().toUpperCase();
  const paidAmount = row.paidAmountSar ?? 0;
  const paidEligible = row.kind === "DIRECT" && ps === "PAID" && paidAmount > 0;

  if (!paidEligible) {
    return { ok: true, refundInclTaxSar: 0, paymentMethod: null };
  }

  const channel: FullRefundChannel = input.refundChannel ?? "ORIGINAL";

  let externalRef: string;
  if (channel === "CASH") {
    // تسليم نقدي في الفرع — لا استرداد إلكتروني؛ يُسجَّل بمرجع يدوي.
    externalRef = `CASH-MANUAL-${row.id}-${Date.now()}`;
  } else {
    const exec = await executeCancellationRefundByPaymentMethod({
      bookingRequestId: row.id,
      paymentMethod: row.paymentMethod,
      refundAmountInclTaxSar: paidAmount,
    });
    if (!exec.ok) {
      // فشل الاسترداد: نتراجع عن الإلغاء بالكامل حتى لا يبقى الحجز ملغى بلا استرداد بصمت.
      console.error("[cancelBookingWithFullRefundByAdmin] refund failed:", exec.error);
      await prisma.bookingRequest.update({
        where: { id: row.id },
        data: {
          status: row.status,
          cancelledAt: null,
          cancellationDeductedDays: null,
          cancellationReasonAr: null,
          balanceDueAtBranchSar: row.balanceDueAtBranchSar,
        },
      });
      return {
        ok: false,
        error:
          "تعذّر تنفيذ الاسترداد عبر بوابة الدفع، ولم يتم إلغاء الحجز. يرجى المحاولة لاحقاً أو التواصل مع الدعم.",
      };
    }
    externalRef = exec.externalRef;
  }

  // تحديث حالة الاسترداد الكامل + سطر REFUND في الدفتر ذرّياً.
  await prisma.$transaction(async (tx) => {
    await tx.bookingRequest.update({
      where: { id: row.id },
      data: {
        paymentStatus: "REFUNDED",
        cancellationRefundAmountSar: paidAmount,
        cancellationRefundExternalRef: externalRef,
      },
    });
    await recordPaymentTransaction(
      {
        bookingId: row.id,
        kind: "REFUND",
        amountSar: paidAmount,
        method: channel === "CASH" ? "CASH" : row.paymentMethod,
        actorKind: "ADMIN",
        actorName: input.actorLabel,
        externalRef,
        notes: `إلغاء إداري باسترداد كامل${channel === "CASH" ? " (نقداً)" : ""}`,
      },
      tx,
    );
  });

  const meta = await currentRequestMeta();
  await logActivity({
    kind: "BOOKING_REFUND",
    path: `/admin/bookings/${row.id}`,
    actorLabel: `${input.actorLabel} — إلغاء باسترداد كامل ${paidAmount} ر.س (${
      channel === "CASH" ? "نقداً في الفرع" : "نفس وسيلة الدفع"
    }). السبب: ${reason}`,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  return {
    ok: true,
    refundInclTaxSar: paidAmount,
    paymentMethod: channel === "CASH" ? "CASH" : row.paymentMethod,
  };
}

export type CancelBookingNoRefundResult =
  | { ok: true; paymentMethod: string | null }
  | { ok: false; error: string };

/**
 * إلغاء إداري بلا استرداد — يتجاوز شرائح خصم السياسة في الاتجاه المعاكس لاسترداد
 * كامل: يُسجَّل خصم كل أيام الحجز ولا يُرَدّ أي مبلغ، حتى لو كانت السياسة العادية
 * قد تسمح باسترداد جزئي. لحالات استثنائية (مخالفة شروط، عدم حضور دون إشعار)
 * ويتطلب سبباً إلزامياً يُسجَّل على الحجز وفي سجل النشاط — تماماً كالاسترداد الكامل.
 */
export async function cancelBookingWithoutRefundByAdmin(input: {
  bookingRequestId: number;
  reasonAr: string;
  actorLabel: string;
}): Promise<CancelBookingNoRefundResult> {
  const reason = input.reasonAr.trim();
  if (!reason) {
    return { ok: false, error: "سبب الإلغاء بلا استرداد إلزامي." };
  }

  const row = await loadBookingForCancel(input.bookingRequestId);
  if (!row) {
    return { ok: false, error: "الطلب غير موجود." };
  }

  const st = row.status.trim().toUpperCase();
  if (st === "CANCELLED") {
    return { ok: false, error: "الطلب ملغى بالفعل." };
  }
  if (TERMINAL_STATUSES.has(st)) {
    return { ok: false, error: "لا يمكن إلغاء طلب في هذه الحالة." };
  }
  if (st === BOOKING_STATUS_RETURNED) {
    return { ok: false, error: "لا يمكن إلغاء حجز تم إرجاع السيارة فيه بالفعل." };
  }

  const ps = row.paymentStatus.trim().toUpperCase();
  const paidAmount = row.paidAmountSar ?? 0;
  const paidEligible = row.kind === "DIRECT" && ps === "PAID" && paidAmount > 0;

  const nowCancel = new Date();
  const baseData = {
    status: "CANCELLED" as const,
    cancelledAt: nowCancel,
    // خصم كامل المدة — لا استرداد مهما كانت شرائح السياسة العادية.
    cancellationDeductedDays: row.numberOfDays,
    cancellationReasonAr: reason,
    balanceDueAtBranchSar: 0,
    ...(paidEligible
      ? {
          paymentStatus: "NO_REFUND" as const,
          cancellationRefundAmountSar: 0,
        }
      : {}),
  };

  // مطالبة ذرّية بالإلغاء — طلب واحد فقط يمرّ، يمنع تكرار المعالجة.
  const claim = await prisma.bookingRequest.updateMany({
    where: {
      id: row.id,
      status: { notIn: ["CANCELLED", "REJECTED", BOOKING_STATUS_RETURNED] },
    },
    data: baseData,
  });
  if (claim.count === 0) {
    return { ok: false, error: "الطلب ملغى بالفعل أو في حالة لا تسمح بالإلغاء." };
  }

  // لا حركة مالية هنا (لا استرداد) — سجل النشاط المالي (logActivity) مخصص لحركات
  // الدفع/الاسترداد فقط؛ تدقيق هذا الإلغاء يتم عبر logBookingEvent في طبقة الأكشن،
  // بنفس نمط cancelAdminBooking.
  return { ok: true, paymentMethod: paidEligible ? row.paymentMethod : null };
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
  if (
    bookingSt === "CANCELLED" ||
    bookingSt === "REJECTED" ||
    bookingSt === BOOKING_STATUS_RETURNED
  )
    return null;
  if (input.kind !== "DIRECT") return null;
  if (input.paymentStatus.trim().toUpperCase() !== "PAID") return null;
  if (input.pricePerDayExclTax == null || input.vatRatePercent == null) return null;

  const deduct =
    bookingSt === BOOKING_STATUS_PICKED_UP
      ? computePickedUpCancellationDeductDays(
          input.pickupDate,
          input.numberOfDays,
          input.tiers,
        )
      : computeCancellationDeductedDays(
          hoursBeforePickup(input.pickupDate, new Date()),
          input.tiers,
          input.numberOfDays,
        );
  const br = computeCancellationRefundBreakdown({
    numberOfDays: input.numberOfDays,
    deductDays: deduct,
    pricePerDayExclTax: input.pricePerDayExclTax,
    vatRatePercent: input.vatRatePercent,
    addonsJson: input.addonsJson,
    retainOneTimeFeesFully: bookingSt === BOOKING_STATUS_PICKED_UP,
  });
  if (!br) return null;

  return {
    paidInclTax: br.paidTotalInclTax,
    refundInclTax: br.refundInclTax,
    methodLabel: bookingPaymentMethodLabelAr(input.paymentMethod),
  };
}
