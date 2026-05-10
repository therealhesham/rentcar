/** حساب أيام الحجز للبحث والتوفر — يُستخدم في الخادم والعميل. */

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function computeBookingDays(pickup: Date, dropoff: Date): number {
  const a = startOfLocalDay(pickup).getTime();
  const b = startOfLocalDay(dropoff).getTime();
  const diff = Math.round((b - a) / 86400000);
  if (!Number.isFinite(diff)) return 1;
  return Math.max(1, Math.min(60, diff === 0 ? 1 : diff));
}
