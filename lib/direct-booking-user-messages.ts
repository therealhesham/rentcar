/** رسائل موحّدة للعميل عند امتلاء الفترة أو عدم وجود أسطول — ملف منفصل لاستخدامه من العميل دون سحب prisma */

export const DIRECT_BOOKING_MSG_UNAVAILABLE_PERIOD = "غير متاح خلال هذه الفترة.";
export const DIRECT_BOOKING_MSG_NO_FLEET = "غير متاح للحجز حالياً.";

/** بادئة داخلية يُزال عند العرض؛ باقي النص عربي للمستخدم. */
export const DIRECT_BOOKING_BRANCH_HOURS_CODE = "[branch-hours]";

export function formatBranchOutsideHoursError(branchName: string): string {
  return `${DIRECT_BOOKING_BRANCH_HOURS_CODE}${branchName}: الفرع غير متاح في الوقت المحدّد. اختر موعداً ضمن مواعيد العمل أو فرعاً آخر.`;
}

export function isBranchOutsideHoursBookingError(error: string | undefined): boolean {
  return Boolean(error?.startsWith(DIRECT_BOOKING_BRANCH_HOURS_CODE));
}

export function stripBranchHoursErrorCodeForDisplay(error: string): string {
  return error.startsWith(DIRECT_BOOKING_BRANCH_HOURS_CODE)
    ? error.slice(DIRECT_BOOKING_BRANCH_HOURS_CODE.length)
    : error;
}

export function isDirectBookingCapacityMessage(error: string | undefined): boolean {
  if (!error) return false;
  return error === DIRECT_BOOKING_MSG_UNAVAILABLE_PERIOD || error === DIRECT_BOOKING_MSG_NO_FLEET;
}
