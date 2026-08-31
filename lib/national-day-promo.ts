/**
 * عرض اليوم الوطني — يستبدل شارة «وفّرت/خصم» الحمراء على كارت السيارة بشارة خضراء
 * خلال سبتمبر ٢٠٢٦ فقط، ثم يرجع السلوك المعتاد تلقائياً بلا أي تدخل يدوي بعدها.
 */
const PROMO_START = new Date("2026-08-30T00:00:00+03:00");
const PROMO_END = new Date("2026-09-30T23:59:59+03:00");

export const NATIONAL_DAY_PROMO_LABEL_AR = "عرض اليوم الوطني";
export const NATIONAL_DAY_PROMO_DATE_RANGE_AR = "";

export function isNationalDayPromoActive(now: Date = new Date()): boolean {
  return now >= PROMO_START && now <= PROMO_END;
}
