/** أسعار صفحة الإتمام: الأسعار والإضافات غير شاملة الضريبة؛ الضريبة على المجموع. */

export type AddonPriceRow = { pricePerDay: number };

export function computeCheckoutTotals(
  pricePerDayExclTax: number,
  days: number,
  vatRatePercent: number,
  selectedAddons: AddonPriceRow[],
): {
  rentalExclTax: number;
  addonsExclTax: number;
  subtotalExclTax: number;
  vatAmount: number;
  totalInclTax: number;
} {
  const d = Math.max(1, Math.round(days));
  const rentalExclTax = pricePerDayExclTax * d;
  const addonsExclTax = selectedAddons.reduce((sum, a) => sum + a.pricePerDay * d, 0);
  const subtotalExclTax = rentalExclTax + addonsExclTax;
  const vatAmount = Math.round(subtotalExclTax * (vatRatePercent / 100) * 100) / 100;
  const totalInclTax = Math.round((subtotalExclTax + vatAmount) * 100) / 100;
  return {
    rentalExclTax,
    addonsExclTax,
    subtotalExclTax,
    vatAmount,
    totalInclTax,
  };
}

export function formatSarAmount(n: number): string {
  return n.toLocaleString("en-US", {
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}
