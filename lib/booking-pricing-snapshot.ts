import {
  DELAY_PENALTY_FREE_HOURS,
  type DelayPenaltySnap,
} from "@/lib/booking-delay-penalty";
import type { InterCityShippingSnap } from "@/lib/inter-city-shipping";
import type { RentalDiscountPriceSnap } from "@/lib/rental-discount";

export type AddonSnapItem = {
  id: number;
  slug: string;
  titleAr: string;
  pricePerDayExclTax: number;
  days: number;
  lineTotalExclTax: number;
};

/** لقطة رسوم ثابتة عند الإتمام (تُدار من الإدارة). */
export type CheckoutOneTimeFeeSnap = {
  slug: string;
  labelAr: string;
  feeExclVatSar: number;
};

export type BookingPricingSnapshotV1 = {
  items: AddonSnapItem[];
  interCityShipping?: InterCityShippingSnap | null;
  checkoutOneTimeFees?: CheckoutOneTimeFeeSnap[] | null;
  delayPenalty?: DelayPenaltySnap | null;
  /** مدة الحجز اليومي للعرض (مثل «يومين + 3 ساعات»). */
  tripDurationLabelAr?: string | null;
  /** لقطة سعر الإيجار بعد الخصم (بدون تفاصيل شرط الخصم). */
  rentalDiscount?: RentalDiscountPriceSnap | null;
  /**
   * سعر الإيجار اليومي الفعلي وقت الحجز/آخر تعديل مدة (بعد الخصم إن وُجد)،
   * غير شامل الضريبة. مُجمَّد بمعزل عن أي تغيير لاحق في سعر الموديل الحالي.
   */
  rentalPricePerDayExclTax?: number | null;
};

function parseDelayPenaltySnap(raw: unknown): DelayPenaltySnap | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as DelayPenaltySnap;
  const fee = Number(o.feeExclVatSar);
  if (!Number.isFinite(fee) || fee <= 0) return null;
  const kind = o.kind;
  if (kind !== "hourly" && kind !== "full_day") return null;
  const lateHours = Number(o.lateHours);
  const billableHours = Number(o.billableHours ?? 0);
  const billableDays = Number(o.billableDays ?? 0);
  if (!Number.isFinite(lateHours) || lateHours <= DELAY_PENALTY_FREE_HOURS) return null;
  const labelAr = typeof o.labelAr === "string" ? o.labelAr.trim() : "";
  if (!labelAr) return null;
  const scheduledReturnAt =
    typeof o.scheduledReturnAt === "string" ? o.scheduledReturnAt : "";
  const actualDropoffAt = typeof o.actualDropoffAt === "string" ? o.actualDropoffAt : "";
  if (!scheduledReturnAt || !actualDropoffAt) return null;
  return {
    kind,
    lateHours,
    billableHours: Number.isFinite(billableHours) ? billableHours : 0,
    billableDays: Number.isFinite(billableDays) ? billableDays : 0,
    feeExclVatSar: Math.round(fee * 100) / 100,
    labelAr,
    scheduledReturnAt,
    actualDropoffAt,
  };
}

export function parseBookingPricingSnapshot(raw: string | null): {
  addons: Array<{
    titleAr: string;
    pricePerDayExclTax: number;
    lineTotalExclTax: number;
  }>;
  interCityShipping: InterCityShippingSnap | null;
  checkoutOneTimeFees: CheckoutOneTimeFeeSnap[];
  delayPenalty: DelayPenaltySnap | null;
  tripDurationLabelAr: string | null;
  rentalDiscount: RentalDiscountPriceSnap | null;
  rentalPricePerDayExclTax: number | null;
} {
  if (!raw) {
    return {
      addons: [],
      interCityShipping: null,
      checkoutOneTimeFees: [],
      delayPenalty: null,
      tripDurationLabelAr: null,
      rentalDiscount: null,
      rentalPricePerDayExclTax: null,
    };
  }
  try {
    const data = JSON.parse(raw) as BookingPricingSnapshotV1;
    const items = Array.isArray(data.items) ? data.items : [];
    const addons = items.map((it) => ({
      titleAr: String(it.titleAr ?? "—"),
      pricePerDayExclTax: Number(it.pricePerDayExclTax ?? 0),
      lineTotalExclTax: Number(it.lineTotalExclTax ?? 0),
    }));
    const s = data.interCityShipping;
    let interCityShipping: InterCityShippingSnap | null = null;
    if (
      s &&
      typeof s === "object" &&
      typeof s.feeExclVatSar === "number" &&
      s.feeExclVatSar > 0 &&
      typeof s.labelAr === "string" &&
      typeof s.fromCitySlug === "string" &&
      typeof s.toCitySlug === "string"
    ) {
      interCityShipping = {
        fromCitySlug: s.fromCitySlug,
        toCitySlug: s.toCitySlug,
        feeExclVatSar: Math.round(s.feeExclVatSar),
        labelAr: s.labelAr,
      };
    }

    const rawCo = data.checkoutOneTimeFees;
    const checkoutOneTimeFees: CheckoutOneTimeFeeSnap[] = [];
    if (Array.isArray(rawCo)) {
      for (const x of rawCo) {
        if (
          x &&
          typeof x === "object" &&
          typeof (x as CheckoutOneTimeFeeSnap).slug === "string" &&
          typeof (x as CheckoutOneTimeFeeSnap).labelAr === "string" &&
          typeof (x as CheckoutOneTimeFeeSnap).feeExclVatSar === "number" &&
          (x as CheckoutOneTimeFeeSnap).feeExclVatSar > 0
        ) {
          checkoutOneTimeFees.push({
            slug: String((x as CheckoutOneTimeFeeSnap).slug).trim().toLowerCase(),
            labelAr: String((x as CheckoutOneTimeFeeSnap).labelAr).trim(),
            feeExclVatSar: Math.round((x as CheckoutOneTimeFeeSnap).feeExclVatSar),
          });
        }
      }
    }

    const delayPenalty = parseDelayPenaltySnap(data.delayPenalty);
    const tripDurationLabelAr =
      typeof data.tripDurationLabelAr === "string" && data.tripDurationLabelAr.trim()
        ? data.tripDurationLabelAr.trim()
        : null;

    let rentalDiscount: RentalDiscountPriceSnap | null = null;
    const rd = data.rentalDiscount;
    if (
      rd &&
      typeof rd === "object" &&
      typeof (rd as RentalDiscountPriceSnap).originalPricePerDayExclTax === "number" &&
      typeof (rd as RentalDiscountPriceSnap).discountedPricePerDayExclTax === "number" &&
      typeof (rd as RentalDiscountPriceSnap).discountPerDayExclTax === "number" &&
      (rd as RentalDiscountPriceSnap).discountPerDayExclTax > 0
    ) {
      rentalDiscount = {
        originalPricePerDayExclTax: Math.round(
          (rd as RentalDiscountPriceSnap).originalPricePerDayExclTax,
        ),
        discountedPricePerDayExclTax: Math.round(
          (rd as RentalDiscountPriceSnap).discountedPricePerDayExclTax,
        ),
        discountPerDayExclTax: Math.round((rd as RentalDiscountPriceSnap).discountPerDayExclTax),
      };
    }

    const rawPrice = data.rentalPricePerDayExclTax;
    const rentalPricePerDayExclTax =
      typeof rawPrice === "number" && Number.isFinite(rawPrice) && rawPrice >= 0
        ? Math.round(rawPrice * 100) / 100
        : null;

    return {
      addons,
      interCityShipping,
      checkoutOneTimeFees,
      delayPenalty,
      tripDurationLabelAr,
      rentalDiscount,
      rentalPricePerDayExclTax,
    };
  } catch {
    return {
      addons: [],
      interCityShipping: null,
      checkoutOneTimeFees: [],
      delayPenalty: null,
      tripDurationLabelAr: null,
      rentalDiscount: null,
      rentalPricePerDayExclTax: null,
    };
  }
}

/**
 * سعر الإيجار اليومي الفعلي المجمَّد وقت الحجز/آخر تعديل مدة — لا يتأثر بأي
 * تغيير لاحق في سعر الموديل الحالي. الأولوية: اللقطة المجمَّدة، ثم لقطة الخصم
 * القديمة (توافق حجوزات سابقة لهذا التغيير)، وأخيراً سعر الموديل الحالي كملاذ
 * أخير للحجوزات القديمة جداً التي لا تملك أي لقطة سعر مخزّنة.
 */
export function resolveBookingRentalPricePerDayExclTax(
  modelPricePerDayExclTax: number,
  addonsJson: string | null,
): number {
  const { rentalPricePerDayExclTax, rentalDiscount } = parseBookingPricingSnapshot(addonsJson);
  if (rentalPricePerDayExclTax != null) {
    return rentalPricePerDayExclTax;
  }
  if (
    rentalDiscount &&
    Number.isFinite(rentalDiscount.discountedPricePerDayExclTax) &&
    rentalDiscount.discountedPricePerDayExclTax >= 0
  ) {
    return rentalDiscount.discountedPricePerDayExclTax;
  }
  return modelPricePerDayExclTax;
}
