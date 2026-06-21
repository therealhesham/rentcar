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
      paidAmountSar: true,
      balanceDueAtBranchSar: true,
      snapshotTotalAmountSar: true,
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
  const extraDue = booking.balanceDueAtBranchSar ?? 0;

  // ─── حساب paidAmountSar النهائي ─────────────────────────────────────────────
  // كاش: نستخدم snapshotTotalAmountSar المجمّد وقت الحجز/التمديد (لا يتأثر بتغيير الأسعار).
  //       fallback: computeCheckoutTotals من addonsJson (لو الـ snapshot غير موجود).
  // مدفوع مسبقاً (أونلاين/كارد): paidAmountSar الأصلي + balanceDueAtBranchSar المتراكم.
  let finalPaidAmountSar: number | null = null;
  if (cash) {
    if (typeof booking.snapshotTotalAmountSar === "number" && booking.snapshotTotalAmountSar > 0) {
      // snapshot مجمّد: لا نعيد الحساب من السعر الحالي
      finalPaidAmountSar = booking.snapshotTotalAmountSar;
    } else if (booking.carModel) {
      // fallback للحجوزات القديمة قبل إضافة الحقل
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
      finalPaidAmountSar = Math.round(totals.totalInclTax * 100) / 100;
    }
  } else if (!cash && extraDue > 0 && typeof booking.paidAmountSar === "number") {
    // مدفوع مسبقاً + فرق مدّد في الفرع
    finalPaidAmountSar = Math.round((booking.paidAmountSar + extraDue) * 100) / 100;
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
            paidAmountSar: finalPaidAmountSar,
          }
        : {
            // للمدفوع أونلاين: نضيف فرق التمديد إلى المدفوع المسجّل
            ...(finalPaidAmountSar !== null ? { paidAmountSar: finalPaidAmountSar } : {}),
          }),
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
      // حساب وحفظ المبلغ الكامل المدفوع (كاش: الإجمالي الفعلي بالأيام الجديدة)
      const br = await prisma.bookingRequest.findUnique({
        where: { id: bookingRequestId },
        select: {
          numberOfDays: true,
          addonsJson: true,
          balanceDueAtBranchSar: true,
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
        // إزالة المبلغ المستحق عند الفرع بعد التسجيل
        (data as Record<string, unknown>).balanceDueAtBranchSar = null;
      }
    } else {
      // مدفوع مسبقاً (أونلاين/كارد): نضيف فرق التمديد إلى paidAmountSar
      const brOnline = await prisma.bookingRequest.findUnique({
        where: { id: bookingRequestId },
        select: { paidAmountSar: true, balanceDueAtBranchSar: true },
      });
      const extraDue = brOnline?.balanceDueAtBranchSar ?? 0;
      if (extraDue > 0 && typeof brOnline?.paidAmountSar === "number") {
        (data as Record<string, unknown>).paidAmountSar =
          Math.round((brOnline.paidAmountSar + extraDue) * 100) / 100;
        (data as Record<string, unknown>).balanceDueAtBranchSar = null;
      } else if (brOnline?.balanceDueAtBranchSar) {
        (data as Record<string, unknown>).balanceDueAtBranchSar = null;
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
