import { prisma } from "@/lib/prisma";
import {
  buildDeliveryFeeSnap,
  haversineKm,
  type DeliveryDistanceSource,
  type DeliveryFeeSnap,
  type DeliveryLeg,
} from "@/lib/delivery-fee";

/**
 * مفتاح جوجل للخادم (Routes API). يُفضَّل مفتاح مستقل غير مقيَّد بالـ referrer؛
 * وإلا نجرّب مفتاح الخريطة العام — وإن رفضه جوجل نرجع للخط المستقيم بدل أن نفشل.
 */
function googleServerKey(): string {
  return (
    process.env.GOOGLE_MAPS_SERVER_API_KEY?.trim() ||
    process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ||
    ""
  );
}

const ROUTE_TIMEOUT_MS = 5000;
const CACHE_TTL_MS = 60 * 60 * 1000;
const CACHE_MAX = 500;

type CachedRoute = { km: number; at: number };
const routeCache = new Map<string, CachedRoute>();

function cacheKey(a: LatLng, b: LatLng): string {
  const r = (n: number) => n.toFixed(5);
  return `${r(a.lat)},${r(a.lng)}>${r(b.lat)},${r(b.lng)}`;
}

type LatLng = { lat: number; lng: number };

/** مسافة القيادة بالكيلومتر من Google Routes، أو null عند أي فشل. */
async function googleDrivingKm(from: LatLng, to: LatLng): Promise<number | null> {
  const key = googleServerKey();
  if (!key) return null;

  const ck = cacheKey(from, to);
  const hit = routeCache.get(ck);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit.km;

  try {
    const res = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Goog-Api-Key": key,
        "X-Goog-FieldMask": "routes.distanceMeters",
      },
      body: JSON.stringify({
        origin: { location: { latLng: { latitude: from.lat, longitude: from.lng } } },
        destination: { location: { latLng: { latitude: to.lat, longitude: to.lng } } },
        travelMode: "DRIVE",
        // بدون حركة مرور: نفس المسافة في كل مرة فيتطابق عرض السعر مع الحجز.
        routingPreference: "TRAFFIC_UNAWARE",
        units: "METRIC",
      }),
      signal: AbortSignal.timeout(ROUTE_TIMEOUT_MS),
      cache: "no-store",
    });
    if (!res.ok) {
      console.warn("[delivery-fee] Google Routes HTTP", res.status);
      return null;
    }
    const data = (await res.json()) as { routes?: Array<{ distanceMeters?: number }> };
    const meters = data.routes?.[0]?.distanceMeters;
    if (typeof meters !== "number" || !Number.isFinite(meters) || meters < 0) return null;
    const km = meters / 1000;
    if (routeCache.size >= CACHE_MAX) {
      const oldest = routeCache.keys().next().value;
      if (oldest !== undefined) routeCache.delete(oldest);
    }
    routeCache.set(ck, { km, at: Date.now() });
    return km;
  } catch (e) {
    console.warn("[delivery-fee] Google Routes failed", e);
    return null;
  }
}

export async function resolveDrivingDistanceKm(
  from: LatLng,
  to: LatLng,
): Promise<{ km: number; source: DeliveryDistanceSource }> {
  const road = await googleDrivingKm(from, to);
  if (road != null) return { km: road, source: "GOOGLE_ROUTES" };
  return { km: haversineKm(from.lat, from.lng, to.lat, to.lng), source: "STRAIGHT_LINE" };
}

function validCoord(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export type DeliveryFeeResolution =
  | { ok: true; snap: DeliveryFeeSnap | null; reason?: "NO_RATE" | "NO_BRANCH_COORDS" }
  | { ok: false; error: string };

/**
 * يحسب لقطة رسوم توصيل اتجاه واحد (فرع الإرجاع ⇄ موقع العميل).
 * `snap = null` يعني لا رسوم (سعر الكيلو صفر أو الفرع بلا إحداثيات).
 */
export async function resolveDeliveryFeeSnap(input: {
  leg: DeliveryLeg;
  branchSlug: string;
  lat: number;
  lng: number;
}): Promise<DeliveryFeeResolution> {
  if (!validCoord(input.lat, input.lng)) {
    return { ok: false, error: "إحداثيات التوصيل غير صالحة." };
  }
  const slug = input.branchSlug.trim().toLowerCase();
  const branch = await prisma.branch.findFirst({
    where: { slug, isActive: true },
    select: { latitude: true, longitude: true, deliveryFeePerKmSar: true },
  });
  if (!branch) return { ok: false, error: "الفرع غير متاح." };

  const rate = branch.deliveryFeePerKmSar ?? 0;
  if (!(rate > 0)) return { ok: true, snap: null, reason: "NO_RATE" };
  if (
    branch.latitude == null ||
    branch.longitude == null ||
    !validCoord(branch.latitude, branch.longitude)
  ) {
    console.warn(`[delivery-fee] فرع ${slug} بلا إحداثيات — لا يمكن احتساب رسوم التوصيل`);
    return { ok: true, snap: null, reason: "NO_BRANCH_COORDS" };
  }

  const branchPt = { lat: branch.latitude, lng: branch.longitude };
  const customerPt = { lat: input.lat, lng: input.lng };
  // الاتجاه الفعلي للرحلة: الفرع ← العميل عند التوصيل، والعميل ← الفرع عند الإرجاع.
  const [from, to] = input.leg === "PICKUP" ? [branchPt, customerPt] : [customerPt, branchPt];
  const { km, source } = await resolveDrivingDistanceKm(from, to);

  return {
    ok: true,
    snap: buildDeliveryFeeSnap({
      leg: input.leg,
      branchSlug: slug,
      lat: input.lat,
      lng: input.lng,
      distanceKm: km,
      ratePerKmSar: rate,
      source,
    }),
  };
}
