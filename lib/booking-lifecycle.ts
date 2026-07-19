/** مراحل تشغيل الحجز: استلام المركبة من الفرع ثم إرجاعها. */

export const BOOKING_STATUS_PICKED_UP = "PICKED_UP";
export const BOOKING_STATUS_RETURNED = "RETURNED";

const TERMINAL_STATUSES = new Set(["CANCELLED", "REJECTED", BOOKING_STATUS_RETURNED]);

export function isBookingPickedUp(status: string | null | undefined): boolean {
  return status?.trim().toUpperCase() === BOOKING_STATUS_PICKED_UP;
}

export function isBookingReturned(status: string | null | undefined): boolean {
  return status?.trim().toUpperCase() === BOOKING_STATUS_RETURNED;
}

/** مرّ موعد استلام الحجز (بدأ فعلياً) — من هذه اللحظة لا يُسمح للعميل بأي إجراء ذاتي عليه. */
export function hasBookingPickupPassed(pickupDate: Date, now: Date = new Date()): boolean {
  return now.getTime() >= pickupDate.getTime();
}

/** يمكن تسجيل استلام السيارة من الفرع. */
export function canRecordPickupFromBranch(booking: {
  kind: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
}): boolean {
  if (booking.kind !== "DIRECT") return false;
  const s = booking.status.trim().toUpperCase();
  if (TERMINAL_STATUSES.has(s) || s === BOOKING_STATUS_PICKED_UP) return false;

  const cash = booking.paymentMethod?.trim().toUpperCase() === "CASH";
  if (cash) {
    return s === "CONFIRMED" || s === "CONTACTED";
  }
  return (
    booking.paymentStatus.trim().toUpperCase() === "PAID" ||
    s === "CONFIRMED" ||
    s === "CONTACTED"
  );
}

/** يمكن تسجيل تسليم السيارة إلى الفرع (الإرجاع). */
export function canRecordReturnToBranch(booking: {
  kind: string;
  status: string;
}): boolean {
  if (booking.kind !== "DIRECT") return false;
  return isBookingPickedUp(booking.status);
}
