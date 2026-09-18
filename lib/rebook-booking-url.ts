/** روابط «إعادة الحجز» بنفس المدة ونوع الاستلام والفرع (مع ضبط التاريخ إذا كان قديماً). */

export type BookingLikeForRebook = {
  kind: "INQUIRY" | "DIRECT";
  carModelId: number | null;
  pickupDate: Date;
  numberOfDays: number;
  pickupMode: string | null;
  pickupBranchSlug: string | null;
  returnBranchSlug: string;
  deliveryLat: number | null;
  deliveryLng: number | null;
  deliveryAddress?: string | null;
  /**
   * طلب حجز قائم يخص العميل — يُمرَّر لصفحة الإتمام ليُستثنى من احتساب «التداخل» عند التحقق من التوفر
   * (تعديل/إعادة حجز لنفس الفترة دون احتساب الحجز الحالي كحاجز إضافي).
   */
  excludeBookingRequestId?: number | null;
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

/**
 * تاريخ استلام افتراضي لـ«إعادة حجز» بدون استثناء الطلب من السعة:
 * إذا انتهت فترة الحجز السابق → نفس منطق الصفحة الرئيسية؛
 * وإلا نبدأ من اليوم التالي لنهاية الفترة (استلام سابق + عدد الأيام) مع نفس ساعة الاستلام،
 * حتى لا يُحسب الطلب الحالي فوق نفسه فيتحقق التوفر كـ«غير متاح» فور الدخول.
 */
export function suggestedPickupForFreshRebook(b: BookingLikeForRebook): Date {
  const days = clampDays(b.numberOfDays);
  const originalPickup = new Date(b.pickupDate);
  const windowEnd = dropoffFromPickupAndDays(originalPickup, days);
  const now = new Date();
  if (windowEnd.getTime() <= now.getTime()) {
    return adjustedPickupForRebook(originalPickup);
  }
  const after = new Date(windowEnd);
  after.setDate(after.getDate() + 1);
  after.setHours(originalPickup.getHours(), originalPickup.getMinutes(), 0, 0);
  if (after.getTime() < now.getTime()) {
    return adjustedPickupForRebook(now);
  }
  return after;
}

export type BuildRebookSearchParamsOptions = {
  /**
   * عند «تعديل الحجز»: true — نُمرّر معرف الطلب ليُستثنى من التداخل ونُبقي تواريخ الاستلام كما كانت (مع ضبط التاريخ القديم).
   * عند «إعادة حجز»: false — لا يُستثنى الطلب السابق من السعة، ويُقترح تاريخ استلام بعد انتهاء الحجز السابق حتى لا يظهر «غير متاح» بسبب تداخل مع نفس الحجز.
   * @default true
   */
  includeExcludeBookingRequestId?: boolean;
};

export function buildRebookSearchParams(
  b: BookingLikeForRebook,
  opts?: BuildRebookSearchParamsOptions,
): URLSearchParams {
  const includeExclude = opts?.includeExcludeBookingRequestId !== false;
  const days = clampDays(b.numberOfDays);
  const pickup = includeExclude
    ? adjustedPickupForRebook(b.pickupDate)
    : suggestedPickupForFreshRebook(b);
  const dropoff = dropoffFromPickupAndDays(pickup, days);
  const isDelivery = b.pickupMode === "DELIVERY";
  const returnSlug = b.returnBranchSlug.trim().toLowerCase() || "jeddah";
  const pickupSlug =
    b.pickupBranchSlug?.trim().toLowerCase() || returnSlug;

  const params = new URLSearchParams();
  params.set("pickup", pickup.toISOString());
  params.set("dropoff", dropoff.toISOString());
  params.set("rental", "daily");
  params.set("mode", isDelivery ? "delivery" : "pickup");
  params.set("days", String(days));

  if (!isDelivery) {
    params.set("pickupBranch", pickupSlug);
    params.set("returnBranch", returnSlug);
  } else {
    params.set("returnBranch", returnSlug);
    if (b.deliveryLat != null && b.deliveryLng != null) {
      params.set("dlat", String(b.deliveryLat));
      params.set("dlng", String(b.deliveryLng));
    }
    const adr = typeof b.deliveryAddress === "string" ? b.deliveryAddress.trim() : "";
    if (adr) {
      params.set("daddr", adr);
    }
  }

  /** يُستخدم في واجهة الحساب لإظهار تلميح «يمكن تعديل التواريخ» في صفحة الإتمام. */
  params.set("rebook", "1");

  const ex = b.excludeBookingRequestId;
  if (
    includeExclude &&
    ex != null &&
    Number.isInteger(ex) &&
    ex >= 1
  ) {
    params.set("excludeBookingRequestId", String(ex));
  } else if (
    !includeExclude &&
    ex != null &&
    Number.isInteger(ex) &&
    ex >= 1
  ) {
    /** يملأ النموذج من الطلب السابق دون استثنائه من احتساب السعة (إعادة حجز). */
    params.set("prefillBookingRequestId", String(ex));
  }

  return params;
}

/** مسار الإتمام مع استثناء الطلب الحالي من التداخل — «تعديل الحجز». */
export function hrefRebookFromBooking(b: BookingLikeForRebook): string {
  const q = buildRebookSearchParams(b);
  const qs = q.toString();
  if (b.kind === "DIRECT" && b.carModelId != null && b.carModelId >= 1) {
    return `/fleet/checkout?modelId=${b.carModelId}&${qs}`;
  }
  return `/fleet?${qs}`;
}

/** مسار الإتمام لإعادة حجز بنفس التفاصيل مع تقويم تعديل التواريخ — بدون استثناء الطلب السابق من السعة. */
export function hrefFreshRebookCheckoutFromBooking(b: BookingLikeForRebook): string {
  const q = buildRebookSearchParams(b, { includeExcludeBookingRequestId: false });
  const qs = q.toString();
  if (b.kind === "DIRECT" && b.carModelId != null && b.carModelId >= 1) {
    return `/fleet/checkout?modelId=${b.carModelId}&${qs}`;
  }
  return `/fleet?${qs}`;
}
