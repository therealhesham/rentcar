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

export const FLEET_CARD_TAX_LINE_EN = "Prices excl. VAT";

export type FleetCardPriceParts = {
  primaryAmount: string;
  primaryLabelAr: string | null;
  primaryLabelEn?: string | null;
  secondaryAmount: string | null;
  secondaryLabelAr: string | null;
  secondaryLabelEn?: string | null;
  footnoteAr: string;
  footnoteEn?: string;
  /** السعر قبل الخصم (منسّق) — للعرض مشطوباً عند وجود خصم */
  originalPrimaryAmount?: string | null;
  /** عبارة مختصرة للعميل: «خصم ١٠٪» أو «وفّرت ٥٠ ر.س» */
  discountLabelAr?: string | null;
  discountLabelEn?: string | null;
  /** «يبدأ من» — عندما يختلف السعر بين الفروع ولم يُحدَّد فرع بعد */
  prefixLabelAr?: string | null;
  prefixLabelEn?: string | null;
  /** «شهرياً» — يُعرض عند بناء البطاقة بالسعر الشهري بدل اليومي */
  periodLabelAr?: string | null;
  periodLabelEn?: string | null;
};

/** أجزاء عرض السعر في بطاقة الأسطول (المبالغ منسّقة بـ en-US). */
export function buildFleetCardPriceParts(
  priceExclTaxSar: number,
  vatRatePercent: number,
  mode: RentalPriceDisplayMode,
  opts?: {
    originalPriceExclTaxSar?: number;
    discountLabelAr?: string | null;
    discountLabelEn?: string | null;
    /** true = السعر يختلف بين الفروع → إظهار «يبدأ من» */
    startingFrom?: boolean;
    /** «شهرياً» عند بناء البطاقة بالسعر الشهري — يحل محل تسمية «في اليوم» الافتراضية */
    periodLabelAr?: string | null;
    periodLabelEn?: string | null;
    locale?: string;
  },
): FleetCardPriceParts {
  const ex = Math.max(0, Math.round(priceExclTaxSar));
  const exFmt = ex.toLocaleString("en-US");
  const incl = dailyRentalInclTaxSar(ex, vatRatePercent);
  const inclFmt = incl.toLocaleString("en-US", {
    minimumFractionDigits: incl % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });

  const originalEx = opts?.originalPriceExclTaxSar;
  const hasDiscount =
    originalEx != null && Math.round(originalEx) > ex;
  const originalPrimaryAmount = hasDiscount
    ? mode === "INCLUSIVE"
      ? dailyRentalInclTaxSar(originalEx, vatRatePercent).toLocaleString("en-US", {
          minimumFractionDigits: incl % 1 === 0 ? 0 : 2,
          maximumFractionDigits: 2,
        })
      : Math.round(originalEx).toLocaleString("en-US")
    : null;

  const discountLabelAr = hasDiscount ? (opts?.discountLabelAr ?? null) : null;
  const discountLabelEn = hasDiscount ? (opts?.discountLabelEn ?? opts?.discountLabelAr ?? null) : null;
  const prefixLabelAr = opts?.startingFrom ? "يبدأ من" : null;
  const prefixLabelEn = opts?.startingFrom ? "Starting from" : null;
  const periodLabelAr = opts?.periodLabelAr ?? null;
  const periodLabelEn = opts?.periodLabelEn ?? (opts?.periodLabelAr === "شهرياً" ? "Monthly" : null);

  if (mode === "INCLUSIVE") {
    return {
      primaryAmount: inclFmt,
      primaryLabelAr: periodLabelAr ?? "في اليوم",
      primaryLabelEn: periodLabelEn ?? "Per day",
      secondaryAmount: null,
      secondaryLabelAr: null,
      secondaryLabelEn: null,
      footnoteAr: `شامل ضريبة القيمة المضافة (${vatRatePercent}٪)`,
      footnoteEn: `Includes VAT (${vatRatePercent}%)`,
      originalPrimaryAmount,
      discountLabelAr,
      discountLabelEn,
      prefixLabelAr,
      prefixLabelEn,
      periodLabelAr,
      periodLabelEn,
    };
  }

  if (mode === "SPLIT") {
    return {
      primaryAmount: exFmt,
      primaryLabelAr: "قبل الضريبة",
      primaryLabelEn: "Before VAT",
      secondaryAmount: inclFmt,
      secondaryLabelAr: `بعد الضريبة (${vatRatePercent}٪)`,
      secondaryLabelEn: `After VAT (${vatRatePercent}%)`,
      footnoteAr: "السعر قبل وبعد ضريبة القيمة المضافة",
      footnoteEn: "Price before and after VAT",
      originalPrimaryAmount: hasDiscount
        ? Math.round(originalEx!).toLocaleString("en-US")
        : null,
      discountLabelAr,
      discountLabelEn,
      prefixLabelAr,
      prefixLabelEn,
      periodLabelAr,
      periodLabelEn,
    };
  }

  return {
    primaryAmount: exFmt,
    primaryLabelAr: null,
    primaryLabelEn: null,
    secondaryAmount: null,
    secondaryLabelAr: null,
    secondaryLabelEn: null,
    footnoteAr: FLEET_CARD_TAX_LINE_AR,
    footnoteEn: FLEET_CARD_TAX_LINE_EN,
    originalPrimaryAmount,
    discountLabelAr,
    discountLabelEn,
    prefixLabelAr,
    prefixLabelEn,
    periodLabelAr,
    periodLabelEn,
  };
}
