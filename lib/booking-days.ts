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

/**
 * أيام الإيجار = فترات ٢٤ ساعة كاملة منذ لحظة الاستلام، لا أيام تقويمية.
 *
 * الساعات المتبقّية بعد آخر فترة كاملة لا تُدوَّر هنا: تتولّاها قواعد الساعات
 * الإضافية (سماح حتى ساعتين، ثم رسم بالساعة، ثم يوم كامل فوق ٤ ساعات) في
 * `booking-delay-penalty`. تدويرها هنا كان يحاسب مرتين على نفس الساعات.
 *
 * الحساب على الفارق الزمني المطلق فيخرج نفس النتيجة على الخادم والمتصفح أياً
 * كان توقيت أيّهما — وهذا شرط لازم لأن `booking-direct-checkout-parse` يقارن
 * حساب الطرفين ويرفض الحجز عند اختلافهما.
 */
export function computeBookingDays(pickup: Date, dropoff: Date): number {
  const ms = dropoff.getTime() - pickup.getTime();
  if (!Number.isFinite(ms)) return 1;
  return Math.max(1, Math.min(60, Math.floor(ms / DAY_MS)));
}

