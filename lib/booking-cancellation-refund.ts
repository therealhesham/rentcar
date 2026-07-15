import { computeCheckoutTotals } from "@/lib/booking-checkout-pricing";
import { parseBookingPricingSnapshot } from "@/lib/booking-pricing-snapshot";

export type CancellationRefundBreakdown = {
  /** إجمالي المدفوع وقت الحجز (شامل الضريبة) — كما في صفحة الدفع. */
  paidTotalInclTax: number;
  /** المبلغ المسترد للعميل (شامل الضريبة) بعد خصم أيام الإلغاء من جزء الإيجار اليومي والإضافات اليومية. */
  refundInclTax: number;
  /** ما يُحتسب محتفظاً به (شامل الضريبة تقريباً = المدفوع − المسترد). */
  retentionInclTax: number;
};

/**
 * يحسب المسترد من لقطة الإضافات وأسعار الموديل كما عند الدفع.
 * - رسوم لمرة واحدة (شحن بين مدن، رسوم إتمام) تُسترد كاملة عند الإلغاء.
 * - خصم السياسة يُطبَّق على (إيجار السيارة + إضافات باليوم) فقط، بنسبة أيام الخصم / إجمالي أيام الحجز.
 */
export function computeCancellationRefundBreakdown(input: {
  numberOfDays: number;
  deductDays: number;
  pricePerDayExclTax: number;
  vatRatePercent: number;
  addonsJson: string | null;
  retainOneTimeFeesFully?: boolean;
}): CancellationRefundBreakdown | null {
  const days = Math.max(1, Math.round(input.numberOfDays));
  const price = Number(input.pricePerDayExclTax);
  const vat = Number(input.vatRatePercent);
  if (!Number.isFinite(price) || price < 0 || !Number.isFinite(vat) || vat < 0) return null;

  const { addons, interCityShipping, checkoutOneTimeFees, delayPenalty } =
    parseBookingPricingSnapshot(input.addonsJson);
  const shipFee = interCityShipping?.feeExclVatSar ?? 0;
  const checkoutFeesSum = checkoutOneTimeFees.reduce((s, x) => s + x.feeExclVatSar, 0);
  const delayFee = delayPenalty?.feeExclVatSar ?? 0;
  const oneTimeFeesExclTax = shipFee + checkoutFeesSum + delayFee;

  const totals = computeCheckoutTotals(
    price,
    days,
    vat,
    addons.map((a) => ({ pricePerDay: a.pricePerDayExclTax })),
    { oneTimeFeesExclTax },
  );

  const deduct = Math.min(Math.max(0, input.deductDays), days);
  const dailyExcl = totals.rentalExclTax + totals.addonsExclTax;
  const retentionDailyExcl = dailyExcl * (deduct / days);
  const retainedOneTimeFeesExcl = input.retainOneTimeFeesFully ? oneTimeFeesExclTax : 0;
  const refundSubExcl = Math.max(
    0,
    totals.subtotalExclTax - retentionDailyExcl - retainedOneTimeFeesExcl,
  );

  const vatRefund =
    totals.subtotalExclTax > 0
      ? Math.round(((refundSubExcl / totals.subtotalExclTax) * totals.vatAmount) * 100) / 100
      : 0;
  const refundInclTax = Math.round((refundSubExcl + vatRefund) * 100) / 100;
  const paidTotalInclTax = totals.totalInclTax;
  const retentionInclTax = Math.round((paidTotalInclTax - refundInclTax) * 100) / 100;

  return { paidTotalInclTax, refundInclTax, retentionInclTax };
}

const EPS = 0.02;

/** حالة الدفع بعد إتمام منطق الاسترداد (للحجوزات التي كانت PAID). */
export function paymentStatusAfterCancellationRefund(
  paidTotalInclTax: number,
  refundInclTax: number,
): "REFUNDED" | "PARTIAL_REFUND" | "NO_REFUND" {
  if (paidTotalInclTax <= EPS) return "REFUNDED";
  if (refundInclTax <= EPS) return "NO_REFUND";
  if (refundInclTax >= paidTotalInclTax - EPS) return "REFUNDED";
  return "PARTIAL_REFUND";
}
