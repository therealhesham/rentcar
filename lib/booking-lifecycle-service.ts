import {
  BOOKING_STATUS_PICKED_UP,
  BOOKING_STATUS_RETURNED,
  canRecordPickupFromBranch,
  canRecordReturnToBranch,
} from "@/lib/booking-lifecycle";
import { isCashPaymentMethod } from "@/lib/booking-cash-flow";
import { sendBookingInvoiceEmailAfterPayment } from "@/lib/booking-invoice-email";
import { prisma } from "@/lib/prisma";
import { computeCheckoutTotals } from "@/lib/booking-checkout-pricing";
import { parseBookingPricingSnapshot, resolveBookingRentalPricePerDayExclTax } from "@/lib/booking-pricing-snapshot";

export type LifecycleActionResult = { ok: true } | { ok: false; error: string };

async function loadDirectBooking(bookingRequestId: number) {
  return prisma.bookingRequest.findUnique({
    where: { id: bookingRequestId },
    select: {
      id: true,
      kind: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      pickupDate: true,
      numberOfDays: true,
      addonsJson: true,
      carModel: {
        select: { price: true, vatRatePercent: true },
      },
    },
  });
}

/** تسجيل استلام السيارة من الفرع — الحالة PICKED_UP. */
export async function recordBookingPickupFromBranch(
  bookingRequestId: number,
): Promise<LifecycleActionResult> {
  const booking = await loadDirectBooking(bookingRequestId);
  if (!booking) return { ok: false, error: "الطلب غير موجود." };
  if (!canRecordPickupFromBranch(booking)) {
    return { ok: false, error: "لا يمكن تسجيل الاستلام في هذه المرحلة." };
  }

  const now = new Date();
  if (now < booking.pickupDate) {
    return { ok: false, error: "لا يمكن استلام السيارة قبل الموعد المحدد للحجز." };
  }

  const updated = await prisma.bookingRequest.updateMany({
    where: {
      id: bookingRequestId,
      kind: "DIRECT",
      status: { notIn: [BOOKING_STATUS_PICKED_UP, BOOKING_STATUS_RETURNED] },
    },
    data: {
      status: BOOKING_STATUS_PICKED_UP,
      vehiclePickedUpAt: now,
    },
  });
  if (updated.count === 0) {
    return { ok: false, error: "تعذّر تسجيل الاستلام. حدّث الصفحة." };
  }
  return { ok: true };
}

/** تسجيل إرجاع السيارة إلى الفرع — الحالة RETURNED؛ للكاش: تأكيد الدفع وإرسال الفاتورة. */
export async function recordBookingReturnToBranch(
  bookingRequestId: number,
): Promise<LifecycleActionResult> {
  const booking = await loadDirectBooking(bookingRequestId);
  if (!booking) return { ok: false, error: "الطلب غير موجود." };
  if (!canRecordReturnToBranch(booking)) {
    return { ok: false, error: "سجّل استلام السيارة من الفرع أولاً." };
  }

  const now = new Date();
  const cash = isCashPaymentMethod(booking.paymentMethod);

  // حساب المبلغ الكامل المدفوع لحظة تأكيد الكاش عند الإرجاع
  let cashPaidAmount: number | null = null;
  if (cash && booking.carModel) {
    const { addons, interCityShipping, checkoutOneTimeFees } = parseBookingPricingSnapshot(booking.addonsJson);
    const effectivePrice = resolveBookingRentalPricePerDayExclTax(booking.carModel.price, booking.addonsJson);
    const shipFee = interCityShipping?.feeExclVatSar ?? 0;
    const feesSum = checkoutOneTimeFees.reduce((s, x) => s + x.feeExclVatSar, 0);
    const totals = computeCheckoutTotals(
      effectivePrice,
      booking.numberOfDays,
      booking.carModel.vatRatePercent,
      addons.map((a) => ({ pricePerDay: a.pricePerDayExclTax })),
      { oneTimeFeesExclTax: shipFee + feesSum },
    );
    cashPaidAmount = totals.totalInclTax;
  }

  const updated = await prisma.bookingRequest.updateMany({
    where: {
      id: bookingRequestId,
      kind: "DIRECT",
      status: BOOKING_STATUS_PICKED_UP,
    },
    data: {
      status: BOOKING_STATUS_RETURNED,
      vehicleReturnedAt: now,
      balanceDueAtBranchSar: null,
      ...(cash
        ? {
            paymentStatus: "PAID",
            paidAt: now,
            paidAmountSar: cashPaidAmount,
          }
        : {}),
    },
  });
  if (updated.count === 0) {
    return { ok: false, error: "تعذّر تسجيل الإرجاع. حدّث الصفحة." };
  }

  if (cash) {
    try {
      await sendBookingInvoiceEmailAfterPayment(bookingRequestId);
    } catch (e) {
      console.error("[booking-invoice-email] بعد إرجاع السيارة (كاش):", e);
    }
  }

  return { ok: true };
}

/** عند تغيير الحالة يدوياً من لوحة التعديل — طوابع زمنية + فاتورة الكاش عند الإرجاع. */
export async function syncLifecycleFromAdminStatusChange(
  bookingRequestId: number,
  previousStatus: string,
  newStatus: string,
  paymentMethod: string | null,
): Promise<void> {
  const prev = previousStatus.trim().toUpperCase();
  const next = newStatus.trim().toUpperCase();
  if (prev === next) return;

  const now = new Date();
  const data: {
    vehiclePickedUpAt?: Date;
    vehicleReturnedAt?: Date;
    paymentStatus?: string;
    paidAt?: Date;
  } = {};

  if (next === BOOKING_STATUS_PICKED_UP && prev !== BOOKING_STATUS_PICKED_UP) {
    data.vehiclePickedUpAt = now;
  }
  if (next === BOOKING_STATUS_RETURNED && prev !== BOOKING_STATUS_RETURNED) {
    data.vehicleReturnedAt = now;
    if (isCashPaymentMethod(paymentMethod)) {
      data.paymentStatus = "PAID";
      data.paidAt = now;
      // حساب وحفظ المبلغ الكامل المدفوع
      const br = await prisma.bookingRequest.findUnique({
        where: { id: bookingRequestId },
        select: {
          numberOfDays: true,
          addonsJson: true,
          carModel: { select: { price: true, vatRatePercent: true } },
        },
      });
      if (br?.carModel) {
        const { addons, interCityShipping, checkoutOneTimeFees } = parseBookingPricingSnapshot(br.addonsJson);
        const effectivePrice = resolveBookingRentalPricePerDayExclTax(br.carModel.price, br.addonsJson);
        const shipFee = interCityShipping?.feeExclVatSar ?? 0;
        const feesSum = checkoutOneTimeFees.reduce((s, x) => s + x.feeExclVatSar, 0);
        const totals = computeCheckoutTotals(
          effectivePrice,
          br.numberOfDays,
          br.carModel.vatRatePercent,
          addons.map((a) => ({ pricePerDay: a.pricePerDayExclTax })),
          { oneTimeFeesExclTax: shipFee + feesSum },
        );
        (data as Record<string, unknown>).paidAmountSar = totals.totalInclTax;
      }
    }
  }

  if (Object.keys(data).length > 0) {
    await prisma.bookingRequest.update({
      where: { id: bookingRequestId },
      data,
    });
  }

  if (
    next === BOOKING_STATUS_RETURNED &&
    prev !== BOOKING_STATUS_RETURNED &&
    isCashPaymentMethod(paymentMethod)
  ) {
    try {
      await sendBookingInvoiceEmailAfterPayment(bookingRequestId);
    } catch (e) {
      console.error("[booking-invoice-email] بعد تغيير الحالة إلى إرجاع (كاش):", e);
    }
  }
}
