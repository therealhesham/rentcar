/**
 * تسعير التأجير: `CarModel.price` = السعر اليومي **بدون** ضريبة.
 * نسبة الضريبة المسجّلة للموديل: `CarModel.vatRatePercent` (افتراضي 15).
 * العرض للزائر: السعر فقط + `DAILY_PRICE_EXCL_TAX_AR`.
 */
export const DAILY_PRICE_EXCL_TAX_AR = "غير شامل الضريبة";

/** تذييل بطاقة السيارة في صفحة الأسطول */
export const FLEET_CARD_TAX_LINE_AR = "الأسعار غير شاملة الضريبة";

/** كيفية عرض السعر اليومي للزائر في الأسطول وصفحة الإتمام (مفتاح `SiteSetting`). */
export type RentalPriceDisplayMode = "EX_TAX" | "INCLUSIVE" | "SPLIT";

const RENTAL_PRICE_DISPLAY_MODES: RentalPriceDisplayMode[] = [
  "EX_TAX",
  "INCLUSIVE",
  "SPLIT",
];

export function parseRentalPriceDisplayMode(
  v: string | null | undefined,
): RentalPriceDisplayMode {
  const t = (v ?? "").trim().toUpperCase();
  return RENTAL_PRICE_DISPLAY_MODES.includes(t as RentalPriceDisplayMode)
    ? (t as RentalPriceDisplayMode)
    : "EX_TAX";
}

/** ضريبة يوم واحد على الإيجار فقط (نفس منطق `computeCheckoutTotals` ليوم واحد دون إضافات). */
export function dailyRentalVatAmountSar(
  priceExclTax: number,
  vatRatePercent: number,
): number {
  const subtotalExclTax = Math.max(0, priceExclTax);
  return Math.round(subtotalExclTax * (vatRatePercent / 100) * 100) / 100;
}

export function dailyRentalInclTaxSar(
  priceExclTax: number,
  vatRatePercent: number,
): number {
  const base = Math.max(0, priceExclTax);
  const vat = dailyRentalVatAmountSar(base, vatRatePercent);
  return Math.round((base + vat) * 100) / 100;
}

export type FleetCardPriceParts = {
  primaryAmount: string;
  primaryLabelAr: string | null;
  secondaryAmount: string | null;
  secondaryLabelAr: string | null;
  footnoteAr: string;
};

/** أجزاء عرض السعر في بطاقة الأسطول (المبالغ منسّقة بـ en-US). */
export function buildFleetCardPriceParts(
  priceExclTaxSar: number,
  vatRatePercent: number,
  mode: RentalPriceDisplayMode,
): FleetCardPriceParts {
  const ex = Math.max(0, Math.round(priceExclTaxSar));
  const exFmt = ex.toLocaleString("en-US");
  const incl = dailyRentalInclTaxSar(ex, vatRatePercent);
  const inclFmt = incl.toLocaleString("en-US", {
    minimumFractionDigits: incl % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });

  if (mode === "INCLUSIVE") {
    return {
      primaryAmount: inclFmt,
      primaryLabelAr: "في اليوم",
      secondaryAmount: null,
      secondaryLabelAr: null,
      footnoteAr: `شامل ضريبة القيمة المضافة (${vatRatePercent}٪)`,
    };
  }

  if (mode === "SPLIT") {
    return {
      primaryAmount: exFmt,
      primaryLabelAr: "قبل الضريبة",
      secondaryAmount: inclFmt,
      secondaryLabelAr: `بعد الضريبة (${vatRatePercent}٪)`,
      footnoteAr: "السعر قبل وبعد ضريبة القيمة المضافة",
    };
  }

  return {
    primaryAmount: exFmt,
    primaryLabelAr: null,
    secondaryAmount: null,
    secondaryLabelAr: null,
    footnoteAr: FLEET_CARD_TAX_LINE_AR,
  };
}
