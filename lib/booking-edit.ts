/** أدوات تعديل تواريخ حجز قائم من حساب العميل: احتساب الإجمالي لعدد أيام جديد وإعادة بناء لقطة الإضافات. */

import { computeCheckoutTotals } from "@/lib/booking-checkout-pricing";
import {
  parseBookingPricingSnapshot,
  resolveBookingRentalPricePerDayExclTax,
} from "@/lib/booking-pricing-snapshot";

export type BookingDaysPriceInput = {
  /** سعر الإيجار اليومي الفعلي (بعد الخصم) غير شامل الضريبة. */
  pricePerDayExclTax: number;
  vatRatePercent: number;
  /** أسعار الإضافات باليوم (غير شاملة الضريبة) — تتكرر بعدد الأيام. */
  addonPerDayExclTax: number[];
  /** رسوم لمرة واحدة لا تتأثر بعدد الأيام (شحن، رسوم إتمام، غرامة تأخير سابقة). */
  oneTimeFeesExclTax: number;
  /** خصم كوبون FULL_TOTAL مُجمَّد (مبلغ ثابت لا يتغيّر مع عدد الأيام). صفر لو لا يوجد أو كان RENTAL_ONLY. */
  discountExclTax: number;
};

/** إجمالي الحجز (شامل الضريبة) لعدد أيام محدّد — دالة نقية صالحة للعميل. */
export function bookingTotalInclTaxForDays(
  input: BookingDaysPriceInput,
  days: number,
): number {
  const totals = computeCheckoutTotals(
    input.pricePerDayExclTax,
    days,
    input.vatRatePercent,
    input.addonPerDayExclTax.map((pricePerDay) => ({ pricePerDay })),
    { oneTimeFeesExclTax: input.oneTimeFeesExclTax, discountExclTax: input.discountExclTax },
  );
  return totals.totalInclTax;
}

/** يستخرج مدخلات احتساب السعر من لقطة الحجز المخزّنة (لتمريرها للعميل وإعادة الحساب الحي). */
export function bookingDaysPriceInputFromSnapshot(
  modelPricePerDayExclTax: number,
  vatRatePercent: number,
  addonsJson: string | null,
): BookingDaysPriceInput {
  const pricePerDayExclTax = resolveBookingRentalPricePerDayExclTax(
    modelPricePerDayExclTax,
    addonsJson,
  );
  const { addons, interCityShipping, checkoutOneTimeFees, delayPenalty, couponCode } =
    parseBookingPricingSnapshot(addonsJson);
  const shipFee = interCityShipping?.feeExclVatSar ?? 0;
  const checkoutFeesSum = checkoutOneTimeFees.reduce((s, x) => s + x.feeExclVatSar, 0);
  const delayFee = delayPenalty?.feeExclVatSar ?? 0;
  return {
    pricePerDayExclTax,
    vatRatePercent,
    addonPerDayExclTax: addons.map((a) => a.pricePerDayExclTax),
    oneTimeFeesExclTax: shipFee + checkoutFeesSum + delayFee,
    discountExclTax: couponCode?.scope === "FULL_TOTAL" ? couponCode.discountExclTax : 0,
  };
}

/**
 * يعيد بناء لقطة الإضافات (addonsJson) بعدد أيام جديد:
 * - يضبط days وlineTotalExclTax لكل إضافة على عدد الأيام الجديد.
 * - يُبقي رسوم الشحن بين المدن ورسوم الإتمام ولقطة الخصم وسعر الإيجار اليومي المجمَّد كما هي.
 * - يُسقط غرامة التأخير ووصف المدة (يُعاد احتسابهما عند الإرجاع).
 */
export function rebuildAddonsJsonForDays(
  addonsJson: string | null,
  newDays: number,
): string | null {
  if (!addonsJson?.trim()) return null;
  let data: {
    items?: Array<{ pricePerDayExclTax?: unknown; [k: string]: unknown }>;
    interCityShipping?: unknown;
    checkoutOneTimeFees?: unknown;
    rentalDiscount?: unknown;
    rentalPricePerDayExclTax?: unknown;
    couponCode?: unknown;
  };
  try {
    data = JSON.parse(addonsJson);
  } catch {
    return addonsJson;
  }

  const days = Math.max(1, Math.round(newDays));
  const items = Array.isArray(data.items)
    ? data.items.map((it) => {
        const ppd = Number(it.pricePerDayExclTax ?? 0);
        return { ...it, days, lineTotalExclTax: ppd * days };
      })
    : [];

  const payload: {
    items: typeof items;
    interCityShipping?: unknown;
    checkoutOneTimeFees?: unknown;
    rentalDiscount?: unknown;
    rentalPricePerDayExclTax?: unknown;
    couponCode?: unknown;
  } = { items };

  if (data.interCityShipping) payload.interCityShipping = data.interCityShipping;
  if (Array.isArray(data.checkoutOneTimeFees) && data.checkoutOneTimeFees.length) {
    payload.checkoutOneTimeFees = data.checkoutOneTimeFees;
  }
  if (data.rentalDiscount) payload.rentalDiscount = data.rentalDiscount;
  if (typeof data.rentalPricePerDayExclTax === "number") {
    payload.rentalPricePerDayExclTax = data.rentalPricePerDayExclTax;
  }
  if (data.couponCode) payload.couponCode = data.couponCode;

  const hasAny =
    items.length > 0 ||
    payload.interCityShipping != null ||
    payload.checkoutOneTimeFees != null ||
    payload.rentalDiscount != null ||
    payload.rentalPricePerDayExclTax != null ||
    payload.couponCode != null;

  return hasAny ? JSON.stringify(payload) : null;
}
