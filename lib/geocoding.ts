/**
 * بحث عن العناوين وتحويل الإحداثيات إلى عنوان نصّي عبر Google Geocoder فقط.
 */

export type GeoPlace = {
  label: string;
  lat: number;
  lng: number;
};

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

export type Geocoding = {
  search: (query: string, signal?: AbortSignal) => Promise<GeoPlace[]>;
  reverse: (lat: number, lng: number, signal?: AbortSignal) => Promise<string>;
};

/** واجهة بحث موحّدة فوق Google Geocoder؛ بدون geocoder جاهز تعيد نتائج فارغة. */
export function createGeocoding(options: {
  googleGeocoder?: google.maps.Geocoder | null;
  lang?: string;
}): Geocoding {
  const lang = options.lang ?? "ar";
  const g = options.googleGeocoder ?? null;

  return {
    async search(query) {
      const q = query.trim();
      if (q.length < 2 || !g) return [];
      try {
        return await searchPlacesGoogle(g, q, lang);
      } catch {
        return [];
      }
    },

    async reverse(lat, lng) {
      if (!g || !isValidCoord(lat, lng)) return "";
      try {
        return await reverseGeocodeGoogle(g, lat, lng, lang);
      } catch {
        return "";
      }
    },
  };
}
