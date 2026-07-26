/**
 * بحث عن العناوين وتحويل الإحداثيات إلى عنوان نصّي.
 *
 * يُفضَّل Google عند توفّر مفتاح خرائط صالح، ويُستخدم Nominatim (OSM) كبديل
 * مجاني بلا مفتاح — وأيضاً كخطة احتياطية عند فشل Google.
 */

export type GeoPlace = {
  label: string;
  lat: number;
  lng: number;
};

const NOMINATIM_BASE = "https://nominatim.openstreetmap.org";
const COUNTRY_CODE = "sa";
const MAX_RESULTS = 5;

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

/* ─────────── OpenStreetMap / Nominatim ─────────── */

type NominatimItem = { display_name?: string; lat?: string; lon?: string };

async function searchPlacesOsm(
  query: string,
  lang: string,
  signal?: AbortSignal,
): Promise<GeoPlace[]> {
  const url = new URL(`${NOMINATIM_BASE}/search`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("q", query);
  url.searchParams.set("countrycodes", COUNTRY_CODE);
  url.searchParams.set("limit", String(MAX_RESULTS));
  url.searchParams.set("accept-language", lang);

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`nominatim search ${res.status}`);

  const items = (await res.json()) as NominatimItem[];
  return items
    .map((it) => ({
      label: it.display_name?.trim() ?? "",
      lat: Number(it.lat),
      lng: Number(it.lon),
    }))
    .filter((p) => p.label.length > 0 && isValidCoord(p.lat, p.lng));
}

async function reverseGeocodeOsm(
  lat: number,
  lng: number,
  lang: string,
  signal?: AbortSignal,
): Promise<string> {
  const url = new URL(`${NOMINATIM_BASE}/reverse`);
  url.searchParams.set("format", "jsonv2");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  url.searchParams.set("accept-language", lang);

  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`nominatim reverse ${res.status}`);

  const data = (await res.json()) as NominatimItem;
  return data.display_name?.trim() ?? "";
}

/* ─────────── Google Geocoder ─────────── */

async function searchPlacesGoogle(
  geocoder: google.maps.Geocoder,
  query: string,
  lang: string,
): Promise<GeoPlace[]> {
  const { results } = await geocoder.geocode({
    address: query,
    region: COUNTRY_CODE,
    componentRestrictions: { country: COUNTRY_CODE },
    language: lang,
  });

  return results.slice(0, MAX_RESULTS).map((r) => ({
    label: r.formatted_address,
    lat: r.geometry.location.lat(),
    lng: r.geometry.location.lng(),
  }));
}

async function reverseGeocodeGoogle(
  geocoder: google.maps.Geocoder,
  lat: number,
  lng: number,
  lang: string,
): Promise<string> {
  const { results } = await geocoder.geocode({
    location: { lat, lng },
    language: lang,
  });
  return results[0]?.formatted_address?.trim() ?? "";
}

/* ─────────── الواجهة الموحّدة ─────────── */

export type Geocoding = {
  search: (query: string, signal?: AbortSignal) => Promise<GeoPlace[]>;
  reverse: (lat: number, lng: number, signal?: AbortSignal) => Promise<string>;
};

/**
 * يبني واجهة بحث موحّدة. عند تمرير `googleGeocoder` تُجرَّب خدمة Google أولاً
 * ويُسقَط تلقائياً إلى Nominatim عند أي خطأ (مفتاح غير مفعّل، حصة منتهية…).
 */
export function createGeocoding(options: {
  googleGeocoder?: google.maps.Geocoder | null;
  lang?: string;
}): Geocoding {
  const lang = options.lang ?? "ar";
  const g = options.googleGeocoder ?? null;

  return {
    async search(query, signal) {
      const q = query.trim();
      if (q.length < 2) return [];
      if (g) {
        try {
          const hits = await searchPlacesGoogle(g, q, lang);
          if (hits.length > 0) return hits;
        } catch {
          /* نُكمل بـ Nominatim */
        }
      }
      return searchPlacesOsm(q, lang, signal);
    },

    async reverse(lat, lng, signal) {
      if (!isValidCoord(lat, lng)) return "";
      if (g) {
        try {
          const label = await reverseGeocodeGoogle(g, lat, lng, lang);
          if (label) return label;
        } catch {
          /* نُكمل بـ Nominatim */
        }
      }
      try {
        return await reverseGeocodeOsm(lat, lng, lang, signal);
      } catch {
        return "";
      }
    },
  };
}
