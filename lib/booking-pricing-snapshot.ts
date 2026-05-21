import {
  DELAY_PENALTY_FREE_HOURS,
  type DelayPenaltySnap,
} from "@/lib/booking-delay-penalty";
import type { InterCityShippingSnap } from "@/lib/inter-city-shipping";

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
} {
  if (!raw) {
    return { addons: [], interCityShipping: null, checkoutOneTimeFees: [], delayPenalty: null };
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

    return { addons, interCityShipping, checkoutOneTimeFees, delayPenalty };
  } catch {
    return { addons: [], interCityShipping: null, checkoutOneTimeFees: [], delayPenalty: null };
  }
}
