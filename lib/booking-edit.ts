/** أدوات تعديل تواريخ حجز قائم من حساب العميل: احتساب الإجمالي لعدد أيام جديد وإعادة بناء لقطة الإضافات. */

import { computeCheckoutTotals } from "@/lib/booking-checkout-pricing";
import {
  parseBookingPricingSnapshot,
  resolveBookingRentalPricePerDayExclTax,
} from "@/lib/booking-pricing-snapshot";
import { capFullTotalDiscountToFloor } from "@/lib/min-price-floor";

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
  /** أرضية السعر الأدنى المُجمَّدة (مكافئ يومي، دون ضريبة). null = بلا أرضية. */
  floorPerDayExclTax: number | null;
};

/**
 * إجمالي الحجز (شامل الضريبة) لعدد أيام محدّد — دالة نقية صالحة للعميل.
 *
 * الأرضية تُعاد فرضها بعدد الأيام الجديد: خصم كوبون `FULL_TOTAL` مبلغ مطلق
 * مُجمَّد لا يتقلّص مع تقليل الأيام، فبدون إعادة القصّ هنا يقدر العميل يقلّل
 * المدة فينزل الصافي تحت الأرضية.
 */
export function bookingTotalInclTaxForDays(
  input: BookingDaysPriceInput,
  days: number,
): number {
  const addonRows = input.addonPerDayExclTax.map((pricePerDay) => ({ pricePerDay }));
  const preDiscount = computeCheckoutTotals(
    input.pricePerDayExclTax,
    days,
    input.vatRatePercent,
    addonRows,
    { oneTimeFeesExclTax: input.oneTimeFeesExclTax },
  );
  const { discountExclTax } = capFullTotalDiscountToFloor(
    input.discountExclTax,
    preDiscount.subtotalExclTax,
    input.floorPerDayExclTax,
    days,
  );
  const totals = computeCheckoutTotals(
    input.pricePerDayExclTax,
    days,
    input.vatRatePercent,
    addonRows,
    { oneTimeFeesExclTax: input.oneTimeFeesExclTax, discountExclTax },
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
  const {
    addons,
    interCityShipping,
    checkoutOneTimeFees,
    delayPenalty,
    couponCode,
    rentalFloorPerDayExclTax,
  } = parseBookingPricingSnapshot(addonsJson);
  const shipFee = interCityShipping?.feeExclVatSar ?? 0;
  const checkoutFeesSum = checkoutOneTimeFees.reduce((s, x) => s + x.feeExclVatSar, 0);
  const delayFee = delayPenalty?.feeExclVatSar ?? 0;
  return {
    pricePerDayExclTax,
    vatRatePercent,
    addonPerDayExclTax: addons.map((a) => a.pricePerDayExclTax),
    oneTimeFeesExclTax: shipFee + checkoutFeesSum + delayFee,
    discountExclTax: couponCode?.scope === "FULL_TOTAL" ? couponCode.discountExclTax : 0,
    // الحجوزات الأقدم من هذا الحقل = بلا أرضية، فسلوكها يبقى كما هو.
    floorPerDayExclTax: rentalFloorPerDayExclTax,
  };
}

/**
 * يعيد تسعير لقطة الحجز على موديل جديد (تبديل السيارة من الإدارة):
 * يستبدل سعر الإيجار اليومي المجمَّد وأرضية السعر بقيم الموديل الجديد في فرع الإرجاع،
 * ويُسقط لقطة الخصم القديمة (كانت تخص الموديل السابق — الخصم الجديد مدموج أصلاً في السعر).
 *
 * الإضافات والرسوم لمرة واحدة وكوبون `FULL_TOTAL` تبقى كما هي: مبالغ مستقلة عن الموديل.
 * كوبون `RENTAL_ONLY` مدموج في السعر اليومي القديم ولا يمكن إعادة اشتقاقه هنا — الاستدعاء
 * يجب أن يرفض التبديل في تلك الحالة (انظر `updateBookingRequestByAdmin`).
 */
export function repriceAddonsJsonForModel(
  addonsJson: string | null,
  pricePerDayExclTax: number,
  floorPerDayExclTax: number | null,
): string {
  let data: Record<string, unknown> = {};
  if (addonsJson?.trim()) {
    try {
      const parsed = JSON.parse(addonsJson);
      if (parsed && typeof parsed === "object") data = parsed as Record<string, unknown>;
    } catch {
      data = {};
    }
  }
  data.rentalPricePerDayExclTax = Math.round(pricePerDayExclTax * 100) / 100;
  if (floorPerDayExclTax != null && floorPerDayExclTax > 0) {
    data.rentalFloorPerDayExclTax = Math.round(floorPerDayExclTax * 100) / 100;
  } else {
    delete data.rentalFloorPerDayExclTax;
  }
  delete data.rentalDiscount;
  if (!Array.isArray(data.items)) data.items = [];
  return JSON.stringify(data);
}

/**
 * يعيد بناء لقطة الإضافات (addonsJson) بعدد أيام جديد:
 * - يضبط days وlineTotalExclTax لكل إضافة على عدد الأيام الجديد.
 * - يُبقي رسوم الشحن بين المدن ورسوم الإتمام ولقطة الخصم وسعر الإيجار اليومي وأرضية السعر المجمَّدين كما هي.
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
    rentalFloorPerDayExclTax?: unknown;
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
    rentalFloorPerDayExclTax?: unknown;
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
  // إسقاط الأرضية هنا كان هيسمح للعميل يهرب منها بمجرد تعديل التواريخ.
  if (typeof data.rentalFloorPerDayExclTax === "number") {
    payload.rentalFloorPerDayExclTax = data.rentalFloorPerDayExclTax;
  }
  if (data.couponCode) payload.couponCode = data.couponCode;

  const hasAny =
    items.length > 0 ||
    payload.interCityShipping != null ||
    payload.checkoutOneTimeFees != null ||
    payload.rentalDiscount != null ||
    payload.rentalPricePerDayExclTax != null ||
    payload.rentalFloorPerDayExclTax != null ||
    payload.couponCode != null;

  return hasAny ? JSON.stringify(payload) : null;
}
