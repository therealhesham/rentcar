/** أقل وأكبر مدة شهرية للاشتراك وباقات البحث (العميل يدخل الرقم بنفسه ضمن هذا النطاق). */
export const MIN_SUBSCRIPTION_DURATION_MONTHS = 3;
export const MAX_SUBSCRIPTION_DURATION_MONTHS = 6;

/**
 * يحلّل CSV اختياري (أرقام صحيحة بين الحدين). إن لم يبقَ شيء يُعاد [الحد الأدنى، الأقصى]
 * لاستخدامهما في عروض تقديرية (مثل نطاق السعر في قائمة الباقات).
 */
export function parseDurationOptionsCsv(csv: string): number[] {
  const parts = csv
    .split(/[,،\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter(
      (n) =>
        Number.isInteger(n) &&
        n >= MIN_SUBSCRIPTION_DURATION_MONTHS &&
        n <= MAX_SUBSCRIPTION_DURATION_MONTHS,
    );
  const unique = [...new Set(parts)].sort((a, b) => a - b);
  if (unique.length > 0) return unique;
  return [MIN_SUBSCRIPTION_DURATION_MONTHS, MAX_SUBSCRIPTION_DURATION_MONTHS];
}

/** أي عدد أشهر صحيح ضمن [3، 6] — لا يعتمد على CSV الخطة للسماح. */
export function isAllowedDuration(_csv: string, months: number): boolean {
  return (
    Number.isInteger(months) &&
    months >= MIN_SUBSCRIPTION_DURATION_MONTHS &&
    months <= MAX_SUBSCRIPTION_DURATION_MONTHS
  );
}
