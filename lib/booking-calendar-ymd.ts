/** حساب أيام الحجز المخزّنة (1–60) — يطابق `safeBookingDays` في direct-booking. */
function safeBookingDays(days: number): number {
  const n = Math.round(Number(days));
  return Math.max(1, Math.min(60, Number.isFinite(n) ? n : 1));
}

/** يوم تقويمي كـ `YYYY-MM-DD` بتقويم UTC (نفس منطق نطاق التوافر). */
export function dateOnlyYmd(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/** نهاية الفترة (حصرية): أول يوم بعد آخر يوم محجوز */
export function addDaysToYmd(ymd: string, days: number): string {
  const u = new Date(`${ymd}T12:00:00.000Z`);
  u.setUTCDate(u.getUTCDate() + days);
  return u.toISOString().slice(0, 10);
}

/** آخر يوم تقويمي ضمن مدة الحجز (ضمناً)، بنفس منطق `bookingRangeYmd`. */
export function lastInclusiveBookingDayYmd(pickupDate: Date, numberOfDays: number): string {
  const startYmd = dateOnlyYmd(pickupDate);
  const d = safeBookingDays(numberOfDays);
  return addDaysToYmd(startYmd, d - 1);
}
