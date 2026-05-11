/** رسائل موحّدة للعميل عند امتلاء الفترة أو عدم وجود أسطول — ملف منفصل لاستخدامه من العميل دون سحب prisma */

export const DIRECT_BOOKING_MSG_UNAVAILABLE_PERIOD = "غير متاح خلال هذه الفترة.";
export const DIRECT_BOOKING_MSG_NO_FLEET = "غير متاح للحجز حالياً.";

export function isDirectBookingCapacityMessage(error: string | undefined): boolean {
  if (!error) return false;
  return error === DIRECT_BOOKING_MSG_UNAVAILABLE_PERIOD || error === DIRECT_BOOKING_MSG_NO_FLEET;
}
