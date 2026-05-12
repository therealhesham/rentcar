/** الأشهر المسموحة لباقات الاشتراك في الواجهة (يشارك كل CSV مع تصفيته). */
const STANDARD_MONTHS = [1, 3, 6] as const;

/** يحوّل «1,3,12» ثم يقيّد إلى شهـر أو 3 أو 6؛ إذا لم يصل شيء نُنشئ الافتراضي الكامل */
export function parseDurationOptionsCsv(csv: string): number[] {
  const parts = csv
    .split(/[,،\s]+/)
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => Number(s))
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 60);
  const unique = [...new Set(parts)].sort((a, b) => a - b);
  const filtered = unique.filter((n) =>
    (STANDARD_MONTHS as readonly number[]).includes(n),
  );
  return filtered.length > 0 ? filtered : [...STANDARD_MONTHS];
}

export function isAllowedDuration(csv: string, months: number): boolean {
  return parseDurationOptionsCsv(csv).includes(months);
}
