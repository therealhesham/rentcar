/** حساب أيام الحجز للبحث والتوفر — يُستخدم في الخادم والعميل. */

const DAY_MS = 86_400_000;
const BRANCH_TZ = "Asia/Riyadh";

/** تاريخ ووقت بداية اليوم التقويمي بتوقيت فرع السعودية (Asia/Riyadh). */
export function startOfBranchDay(d: Date): Date {
  if (Number.isNaN(d.getTime())) return new Date(NaN);
  const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: BRANCH_TZ }).format(d);
  return new Date(`${ymd}T00:00:00+03:00`);
}

/** رسالة موحّدة عند عدم كون التسليم بعد الاستلام (يشمل تطابق التاريخ والوقت). */
export const DROPOFF_AFTER_PICKUP_ERROR_AR =
  "وقت التسليم يجب أن يكون بعد وقت الاستلام — لا يمكن أن يكونا في نفس الموعد.";

export const DROPOFF_AFTER_PICKUP_ERROR_EN =
  "Return time must be after pickup time — they cannot be the same.";

/** التسليم لازم يكون لاحقاً للاستلام فعلياً؛ التطابق التام مرفوض. */
export function isDropoffAfterPickup(pickup: Date, dropoff: Date): boolean {
  const p = pickup.getTime();
  const d = dropoff.getTime();
  if (Number.isNaN(p) || Number.isNaN(d)) return false;
  return d > p;
}

export function computeBookingDays(pickup: Date, dropoff: Date): number {
  const a = startOfBranchDay(pickup).getTime();
  const b = startOfBranchDay(dropoff).getTime();
  const diff = Math.round((b - a) / DAY_MS);
  if (!Number.isFinite(diff)) return 1;
  return Math.max(1, Math.min(60, diff === 0 ? 1 : diff));
}

