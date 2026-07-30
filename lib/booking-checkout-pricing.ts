/** أسعار صفحة الإتمام: الأسعار والإضافات غير شاملة الضريبة؛ الضريبة على المجموع. */

export type AddonPriceRow = { pricePerDay: number };

export function computeCheckoutTotals(
  pricePerDayExclTax: number,
  days: number,
  vatRatePercent: number,
  selectedAddons: AddonPriceRow[],
  opts?: { oneTimeFeesExclTax?: number; discountExclTax?: number },
): {
  rentalExclTax: number;
  addonsExclTax: number;
  oneTimeFeesExclTax: number;
  discountExclTax: number;
  subtotalExclTax: number;
  vatAmount: number;
  totalInclTax: number;
} {
  const d = Math.max(1, Math.round(days));
  const rentalExclTax = pricePerDayExclTax * d;
  const addonsExclTax = selectedAddons.reduce((sum, a) => sum + a.pricePerDay * d, 0);
  const oneTimeFeesExclTax = Math.max(0, Math.round(opts?.oneTimeFeesExclTax ?? 0));
  const subtotalBeforeDiscount = rentalExclTax + addonsExclTax + oneTimeFeesExclTax;
  const discountExclTax = Math.max(
    0,
    Math.min(subtotalBeforeDiscount, Math.round((opts?.discountExclTax ?? 0) * 100) / 100),
  );
  const subtotalExclTax = subtotalBeforeDiscount - discountExclTax;
  const vatAmount = Math.round(subtotalExclTax * (vatRatePercent / 100) * 100) / 100;
  const totalInclTax = Math.round((subtotalExclTax + vatAmount) * 100) / 100;
  return {
    rentalExclTax,
    addonsExclTax,
    oneTimeFeesExclTax,
    discountExclTax,
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
