import type { BookingCityBranchesOption } from "@/lib/booking-location-options";

export type CityGeoPoint = { lat: number; lng: number };

/** مراكز تقريبية لمدن سعودية شائعة — تُكمّل إحداثيات الفروع من قاعدة البيانات. */
const CITY_CENTER_BY_SLUG: Record<string, CityGeoPoint> = {
  riyadh: { lat: 24.7136, lng: 46.6753 },
  jeddah: { lat: 21.4858, lng: 39.1925 },
  dammam: { lat: 26.4207, lng: 50.0888 },
  khobar: { lat: 26.2794, lng: 50.208 },
  "al-khobar": { lat: 26.2794, lng: 50.208 },
  makkah: { lat: 21.3891, lng: 39.8579 },
  mecca: { lat: 21.3891, lng: 39.8579 },
  madinah: { lat: 24.5247, lng: 39.5692 },
  medina: { lat: 24.5247, lng: 39.5692 },
  taif: { lat: 21.2703, lng: 40.4158 },
  abha: { lat: 18.2465, lng: 42.5117 },
  tabuk: { lat: 28.3838, lng: 36.555 },
  hail: { lat: 27.5236, lng: 41.7001 },
  jazan: { lat: 16.8894, lng: 42.5706 },
  yanbu: { lat: 24.0895, lng: 38.0618 },
  buraidah: { lat: 26.326, lng: 43.975 },
  "khamis-mushait": { lat: 18.3, lng: 42.7333 },
  najran: { lat: 17.4933, lng: 44.1277 },
  jubail: { lat: 27.0174, lng: 49.6225 },
  "al-ahsa": { lat: 25.3832, lng: 49.5877 },
  hofuf: { lat: 25.3832, lng: 49.5877 },
};

/** أسماء بديلة في العنوان النصّي (عربي/إنجليزي) → slug */
const CITY_NAME_ALIASES: ReadonlyArray<{ slug: string; patterns: string[] }> = [
  { slug: "riyadh", patterns: ["الرياض", "رياض", "riyadh", "ar riyadh"] },
  { slug: "jeddah", patterns: ["جدة", "جده", "jeddah", "jiddah"] },
  { slug: "dammam", patterns: ["الدمام", "دمام", "dammam"] },
  { slug: "khobar", patterns: ["الخبر", "خبر", "khobar", "al khobar", "alkhobar"] },
  { slug: "makkah", patterns: ["مكة", "مكه", "مكة المكرمة", "makkah", "mecca"] },
  { slug: "madinah", patterns: ["المدينة", "المدينة المنورة", "مدينة", "madinah", "medina"] },
  { slug: "taif", patterns: ["الطائف", "طائف", "taif"] },
  { slug: "abha", patterns: ["أبها", "ابها", "abha"] },
  { slug: "tabuk", patterns: ["تبوك", "tabuk"] },
  { slug: "hail", patterns: ["حائل", "حايل", "hail"] },
  { slug: "jazan", patterns: ["جازان", "جيزان", "jazan", "jizan"] },
  { slug: "yanbu", patterns: ["ينبع", "yanbu"] },
  { slug: "buraidah", patterns: ["بريدة", "buraidah", "buraydah"] },
  { slug: "jubail", patterns: ["الجبيل", "جبيل", "jubail"] },
];

function normalizeMatchText(s: string): string {
  return s
    .replace(/[\u064B-\u065F\u0670]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

import { parseCoordsFromLocationString } from "./map-url-resolver";

/** يستخرج lat/lng من روابط خرائط جوجل الشائعة. */
export function parseLatLngFromMapUrl(url: string | null | undefined): CityGeoPoint | null {
  return parseCoordsFromLocationString(url);
}

function isValidCoord(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

export function cityCenterForSlug(slug: string): CityGeoPoint | null {
  const key = slug.trim().toLowerCase();
  return CITY_CENTER_BY_SLUG[key] ?? null;
}

/** نقطة مركزية للمدينة: من الحقل الاختياري ثم جدول المدن المعروفة. */
export function resolveCityCenter(city: BookingCityBranchesOption): CityGeoPoint | null {
  if (
    city.centerLat != null &&
    city.centerLng != null &&
    isValidCoord(city.centerLat, city.centerLng)
  ) {
    return { lat: city.centerLat, lng: city.centerLng };
  }
  return cityCenterForSlug(city.slug);
}

function haversineKm(a: CityGeoPoint, b: CityGeoPoint): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;
  const x =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}

/**
 * أقصى مسافة نعتبر عندها النقطة «داخل» المدينة. بدونها كانت أقرب مدينة تفوز
 * دائماً — فيظهر مثلاً «تبوك» لدبوس في الرياض لمجرد أنها الأقرب.
 */
const MAX_CITY_MATCH_KM = 120;

export function resolveDeliveryCityFromCoords(
  lat: number,
  lng: number,
  cities: ReadonlyArray<BookingCityBranchesOption>,
): string | null {
  if (!isValidCoord(lat, lng) || cities.length === 0) return null;

  const point = { lat, lng };
  let bestSlug: string | null = null;
  let bestKm = Infinity;

  for (const city of cities) {
    const center = resolveCityCenter(city);
    if (!center) continue;
    const km = haversineKm(point, center);
    if (km < bestKm) {
      bestKm = km;
      bestSlug = city.slug;
    }
  }

  return bestKm <= MAX_CITY_MATCH_KM ? bestSlug : null;
}

export function resolveDeliveryCityFromAddress(
  address: string,
  cities: ReadonlyArray<BookingCityBranchesOption>,
): string | null {
  const norm = normalizeMatchText(address);
  if (!norm) return null;

  const slugSet = new Set(cities.map((c) => c.slug.trim().toLowerCase()));
  let bestSlug: string | null = null;
  let bestScore = 0;

  for (const city of cities) {
    const slug = city.slug.trim().toLowerCase();
    const nameNorm = normalizeMatchText(city.name);
    if (nameNorm.length >= 2 && norm.includes(nameNorm)) {
      const score = nameNorm.length + 100;
      if (score > bestScore) {
        bestScore = score;
        bestSlug = slug;
      }
    }
  }

  for (const alias of CITY_NAME_ALIASES) {
    if (!slugSet.has(alias.slug)) continue;
    for (const pattern of alias.patterns) {
      const p = normalizeMatchText(pattern);
      if (p.length < 2) continue;
      if (norm.includes(p)) {
        const score = p.length;
        if (score > bestScore) {
          bestScore = score;
          bestSlug = alias.slug;
        }
      }
    }
  }

  return bestSlug;
}

/**
 * يحدّد slug مدينة التوصيل من الإحداثيات و/أو العنوان مقابل مدن قاعدة البيانات.
 * الإحداثيات أولاً (أدق)، ثم مطابقة اسم المدينة في العنوان.
 */
export function resolveDeliveryOriginCitySlug(input: {
  lat: number | null | undefined;
  lng: number | null | undefined;
  address: string | null | undefined;
  cities: ReadonlyArray<BookingCityBranchesOption>;
}): string | null {
  const { cities } = input;
  if (cities.length === 0) return null;

  const lat = input.lat;
  const lng = input.lng;
  if (lat != null && lng != null && Number.isFinite(lat) && Number.isFinite(lng)) {
    const fromCoords = resolveDeliveryCityFromCoords(lat, lng, cities);
    if (fromCoords) return fromCoords;
  }

  const addr = (input.address ?? "").trim();
  if (addr.length > 0) {
    return resolveDeliveryCityFromAddress(addr, cities);
  }

  return null;
}

/** يحسب مركز مدينة من إحداثيات فروعها (متوسط) أو slug معروف. */
export function computeCityCenterFromBranchCoords(
  slug: string,
  branchCoords: CityGeoPoint[],
): CityGeoPoint | null {
  if (branchCoords.length > 0) {
    const lat =
      branchCoords.reduce((s, p) => s + p.lat, 0) / branchCoords.length;
    const lng =
      branchCoords.reduce((s, p) => s + p.lng, 0) / branchCoords.length;
    if (isValidCoord(lat, lng)) return { lat, lng };
  }
  return cityCenterForSlug(slug);
}
