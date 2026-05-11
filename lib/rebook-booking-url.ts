/** روابط «إعادة الحجز» بنفس المدة ونوع الاستلام والفرع (مع ضبط التاريخ إذا كان قديماً). */

export type BookingLikeForRebook = {
  kind: "INQUIRY" | "DIRECT";
  carModelId: number | null;
  pickupDate: Date;
  numberOfDays: number;
  pickupMode: string | null;
  branch: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
};

function clampDays(n: number): number {
  if (!Number.isFinite(n)) return 1;
  return Math.max(1, Math.min(60, Math.round(n)));
}

/** إذا كان تاريخ الاستلام قديماً، نستخدم اليوم/غداً مع نفس ساعة الدقيقة الأصلية قدر الإمكان. */
export function adjustedPickupForRebook(original: Date): Date {
  const now = new Date();
  const d = new Date(original);
  if (d.getTime() >= now.getTime()) return d;
  const out = new Date(now);
  out.setHours(d.getHours(), d.getMinutes(), 0, 0);
  if (out.getTime() < now.getTime()) {
    out.setDate(out.getDate() + 1);
  }
  return out;
}

function dropoffFromPickupAndDays(pickup: Date, days: number): Date {
  const end = new Date(pickup);
  end.setDate(end.getDate() + days);
  return end;
}

export function buildRebookSearchParams(b: BookingLikeForRebook): URLSearchParams {
  const days = clampDays(b.numberOfDays);
  const pickup = adjustedPickupForRebook(b.pickupDate);
  const dropoff = dropoffFromPickupAndDays(pickup, days);
  const isDelivery = b.pickupMode === "DELIVERY";
  const branchSlug = b.branch.trim().toLowerCase() || "jeddah";

  const params = new URLSearchParams();
  params.set("pickup", pickup.toISOString());
  params.set("dropoff", dropoff.toISOString());
  params.set("rental", "daily");
  params.set("mode", isDelivery ? "delivery" : "pickup");
  params.set("days", String(days));

  if (!isDelivery) {
    params.set("pickupBranch", branchSlug);
    params.set("returnBranch", branchSlug);
  } else {
    params.set("returnBranch", branchSlug);
    if (b.deliveryLat != null && b.deliveryLng != null) {
      params.set("dlat", String(b.deliveryLat));
      params.set("dlng", String(b.deliveryLng));
    }
  }

  return params;
}

/** مسار الحجز المباشر أو قائمة الأسطول مع نفس باراميترات البحث. */
export function hrefRebookFromBooking(b: BookingLikeForRebook): string {
  const q = buildRebookSearchParams(b);
  const qs = q.toString();
  if (b.kind === "DIRECT" && b.carModelId != null && b.carModelId >= 1) {
    return `/fleet/checkout?modelId=${b.carModelId}&${qs}`;
  }
  return `/fleet?${qs}`;
}
