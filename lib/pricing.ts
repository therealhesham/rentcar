/**
 * تسعير التأجير: `CarModel.price` = السعر اليومي **بدون** ضريبة.
 * نسبة الضريبة المسجّلة للموديل: `CarModel.vatRatePercent` (افتراضي 15).
 * العرض للزائر: السعر فقط + `DAILY_PRICE_EXCL_TAX_AR`.
 */
export const DAILY_PRICE_EXCL_TAX_AR = "غير شامل الضريبة";

/** تذييل بطاقة السيارة في صفحة الأسطول */
export const FLEET_CARD_TAX_LINE_AR = "الأسعار غير شاملة الضريبة";

/** للعناوين الطويلة (فلاتر، إلخ) */
export const DAILY_PRICE_LABEL_EXCL_TAX_AR =
  "السعر اليومي (ر.س، غير شامل الضريبة)";
