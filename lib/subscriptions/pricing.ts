/**
 * أسعار اشتراك مبسطة: مجموع الشهور + عربون (جميع القيم خارج الضريبة كما في باقي الموقع).
 */
export function subscriptionSubtotalExclVat(
  monthlyPriceSar: number,
  durationMonths: number,
  depositSar: number,
): number {
  return Math.round(monthlyPriceSar * durationMonths + depositSar);
}

export function vatFromSubtotal(subtotalExclVat: number, vatRatePercent: number): number {
  return Math.round((subtotalExclVat * vatRatePercent) / 100);
}

/** رسوم تجاوز الرصيد؛ لا تُحمّى إذا usedKm <= allowance. */
export function extraMileageFeeSar(opts: {
  mileageUsedKm: number;
  mileageAllowanceKm: number;
  extraKmFeeSarPerKm: number;
}): number {
  const { mileageUsedKm, mileageAllowanceKm, extraKmFeeSarPerKm } = opts;
  const excess = Math.max(0, mileageUsedKm - mileageAllowanceKm);
  return Math.round(excess * extraKmFeeSarPerKm);
}
