/**
 * حساب اشتراك شهري بتقويم مستقر بتوقيت UTC (اليوم المرجّع = اليوم الذي اختاره المستخدم بتنسيق yyyy-mm-dd).
 */
export function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0));
}

/** شهر تقويمي بحسب حقول UTC — نفس فكرة addLocalCalendarMonths في booking-search-shared. */
export function addUtcCalendarMonths(base: Date, months: number): Date {
  const d = new Date(base.getTime());
  const day = d.getUTCDate();
  d.setUTCMonth(d.getUTCMonth() + months);
  if (d.getUTCDate() !== day) {
    d.setUTCDate(0);
  }
  return d;
}
