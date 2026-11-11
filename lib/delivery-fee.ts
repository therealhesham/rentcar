/**
 * رسوم التوصيل بالكيلومتر — منطق نقي (يصلح للخادم والمتصفح).
 *
 * القواعد:
 * - الرسوم = المسافة المحتسبة (كم) × سعر الكيلو في فرع الإرجاع.
 * - المسافة طريق فعلي من جوجل (راجع `delivery-fee-server.ts`) وإلا خط مستقيم.
 * - حد أدنى للمسافة المحتسبة: كيلومتر واحد.
 * - اتجاه واحد لكل رحلة، ولكل اتجاه لقطة مستقلة: استلام (PICKUP) وإرجاع (RETURN).
 * - الضريبة تُضاف فوق الرسوم ضمن `computeCheckoutTotals` مثل باقي الرسوم.
 * - اللقطة تُجمَّد داخل `addonsJson` لحظة الحجز **ولا يُعاد حسابها** بعدها:
 *   تغيير سعر الكيلو أو إحداثيات الفرع لا يمسّ الحجوزات القائمة.
 */

/** أقل مسافة تُحتسب عليها الرسوم. */
export const DELIVERY_MIN_BILLED_KM = 1;

export type DeliveryLeg = "PICKUP" | "RETURN";

export type DeliveryDistanceSource = "GOOGLE_ROUTES" | "STRAIGHT_LINE";

export type DeliveryFeeSnap = {
  leg: DeliveryLeg;
  /** فرع الإرجاع الذي يُحسب منه/إليه التوصيل. */
  branchSlug: string;
  /** موقع العميل. */
  lat: number;
  lng: number;
  /** المسافة الفعلية بالكيلومتر (طريق أو خط مستقيم). */
  distanceKm: number;
  /** المسافة المحتسبة بعد الحد الأدنى. */
  billedKm: number;
  ratePerKmSar: number;
  /** الرسوم قبل الضريبة (ريال كامل). */
  feeExclVatSar: number;
  source: DeliveryDistanceSource;
  labelAr: string;
};

export function haversineKm(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** المسافة المحتسبة: تقريب لعشر كم مع حد أدنى كيلومتر واحد. */
export function billedKmFor(distanceKm: number): number {
  const d = Number.isFinite(distanceKm) && distanceKm > 0 ? distanceKm : 0;
  return Math.max(DELIVERY_MIN_BILLED_KM, Math.round(d * 10) / 10);
}

/** الرسوم بالريال الكامل (نفس تقريب `computeCheckoutTotals` للرسوم لمرة واحدة). */
export function deliveryFeeFor(billedKm: number, ratePerKmSar: number): number {
  if (!Number.isFinite(ratePerKmSar) || ratePerKmSar <= 0) return 0;
  return Math.max(1, Math.round(billedKm * ratePerKmSar));
}

export function deliveryLegLabelAr(leg: DeliveryLeg, billedKm: number): string {
  const km = billedKm.toFixed(1);
  return leg === "PICKUP"
    ? `رسوم توصيل السيارة إلى موقعك (${km} كم)`
    : `رسوم استلام السيارة من موقعك عند الإرجاع (${km} كم)`;
}

export function buildDeliveryFeeSnap(input: {
  leg: DeliveryLeg;
  branchSlug: string;
  lat: number;
  lng: number;
  distanceKm: number;
  ratePerKmSar: number;
  source: DeliveryDistanceSource;
}): DeliveryFeeSnap | null {
  const billedKm = billedKmFor(input.distanceKm);
  const feeExclVatSar = deliveryFeeFor(billedKm, input.ratePerKmSar);
  if (feeExclVatSar <= 0) return null;
  return {
    leg: input.leg,
    branchSlug: input.branchSlug,
    lat: input.lat,
    lng: input.lng,
    distanceKm: Math.round(input.distanceKm * 100) / 100,
    billedKm,
    ratePerKmSar: input.ratePerKmSar,
    feeExclVatSar,
    source: input.source,
    labelAr: deliveryLegLabelAr(input.leg, billedKm),
  };
}

export function sumDeliveryFeesExclVat(
  snaps: ReadonlyArray<Pick<DeliveryFeeSnap, "feeExclVatSar">>,
): number {
  return snaps.reduce((s, x) => s + x.feeExclVatSar, 0);
}

/** تحقق/تطبيع لقطات محفوظة في `addonsJson` (تتجاهل أي عنصر تالف). */
export function parseDeliveryFeeSnaps(raw: unknown): DeliveryFeeSnap[] {
  if (!Array.isArray(raw)) return [];
  const out: DeliveryFeeSnap[] = [];
  const seen = new Set<DeliveryLeg>();
  for (const x of raw) {
    if (!x || typeof x !== "object") continue;
    const o = x as Partial<DeliveryFeeSnap>;
    if (o.leg !== "PICKUP" && o.leg !== "RETURN") continue;
    if (seen.has(o.leg)) continue;
    const fee = Number(o.feeExclVatSar);
    const billedKm = Number(o.billedKm);
    if (!Number.isFinite(fee) || fee <= 0 || !Number.isFinite(billedKm)) continue;
    seen.add(o.leg);
    out.push({
      leg: o.leg,
      branchSlug: typeof o.branchSlug === "string" ? o.branchSlug : "",
      lat: Number(o.lat),
      lng: Number(o.lng),
      distanceKm: Number.isFinite(Number(o.distanceKm)) ? Number(o.distanceKm) : billedKm,
      billedKm,
      ratePerKmSar: Number.isFinite(Number(o.ratePerKmSar)) ? Number(o.ratePerKmSar) : 0,
      feeExclVatSar: Math.round(fee),
      source: o.source === "GOOGLE_ROUTES" ? "GOOGLE_ROUTES" : "STRAIGHT_LINE",
      labelAr:
        typeof o.labelAr === "string" && o.labelAr.trim()
          ? o.labelAr.trim()
          : deliveryLegLabelAr(o.leg, billedKm),
    });
  }
  return out;
}

/** مفاتيح `slug` للرسوم داخل قائمة الرسوم لمرة واحدة المعروضة والمجمّعة. */
export function deliveryFeeSlug(leg: DeliveryLeg): string {
  return leg === "PICKUP" ? "delivery-pickup" : "delivery-return";
}
