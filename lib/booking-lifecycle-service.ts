import {
  BOOKING_STATUS_PICKED_UP,
  BOOKING_STATUS_RETURNED,
  canRecordPickupFromBranch,
  canRecordReturnToBranch,
} from "@/lib/booking-lifecycle";
import { isCashPaymentMethod } from "@/lib/booking-cash-flow";
import { sendBookingInvoiceEmailAfterPayment } from "@/lib/booking-invoice-email";
import { prisma } from "@/lib/prisma";

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
