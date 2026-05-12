import type { InterCityShippingSnap } from "@/lib/inter-city-shipping";

export type AddonSnapItem = {
  id: number;
  slug: string;
  titleAr: string;
  pricePerDayExclTax: number;
  days: number;
  lineTotalExclTax: number;
};

export type BookingPricingSnapshotV1 = {
  items: AddonSnapItem[];
  interCityShipping?: InterCityShippingSnap | null;
};

export function parseBookingPricingSnapshot(raw: string | null): {
  addons: Array<{
    titleAr: string;
    pricePerDayExclTax: number;
    lineTotalExclTax: number;
  }>;
  interCityShipping: InterCityShippingSnap | null;
} {
  if (!raw) {
    return { addons: [], interCityShipping: null };
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
    return { addons, interCityShipping };
  } catch {
    return { addons: [], interCityShipping: null };
  }
}
