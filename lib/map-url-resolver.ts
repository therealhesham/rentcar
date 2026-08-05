export type GeoPoint = { lat: number; lng: number };

function isValidCoord(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    (lat !== 0 || lng !== 0)
  );
}

/**
 * 1. استخراج الإحداثيات المباشرة (lat, lng) من النص أو الرابط باستخدام Regex
 */
export function parseCoordsFromLocationString(rawInput: string | null | undefined): GeoPoint | null {
  if (!rawInput) return null;
  let raw = rawInput.trim();
  if (!raw || raw === "-") return null;

  try {
    raw = decodeURIComponent(raw);
  } catch {}

  const patterns: Array<{ regex: RegExp; latIndex: number; lngIndex: number }> = [
    { regex: /[?&]q=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/i, latIndex: 1, lngIndex: 2 },
    { regex: /[?&]query=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/i, latIndex: 1, lngIndex: 2 },
    { regex: /[?&]destination=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/i, latIndex: 1, lngIndex: 2 },
    { regex: /[?&]daddr=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/i, latIndex: 1, lngIndex: 2 },
    { regex: /[?&]sll=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/i, latIndex: 1, lngIndex: 2 },
    { regex: /!3d(-?\d+\.?\d*)!4d(-?\d+\.?\d*)/i, latIndex: 1, lngIndex: 2 },
    { regex: /@(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/i, latIndex: 1, lngIndex: 2 },
    { regex: /ll=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/i, latIndex: 1, lngIndex: 2 },
    { regex: /center=(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/i, latIndex: 1, lngIndex: 2 },
    { regex: /search\/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/i, latIndex: 1, lngIndex: 2 },
    { regex: /place\/[^\/]*\/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)/i, latIndex: 1, lngIndex: 2 },
    { regex: /\/(-?\d+\.?\d*),\s*(-?\d+\.?\d*)(?:[\/\?]|$)/i, latIndex: 1, lngIndex: 2 },
    { regex: /^(-?\d+\.?\d*),\s*(-?\d+\.?\d*)$/i, latIndex: 1, lngIndex: 2 },
  ];

  for (const { regex, latIndex, lngIndex } of patterns) {
    const m = raw.match(regex);
    if (m) {
      const lat = parseFloat(m[latIndex]);
      const lng = parseFloat(m[lngIndex]);
      if (isValidCoord(lat, lng)) {
        return { lat, lng };
      }
    }
  }

  return null;
}

/**
 * 2. فك الروابط المختصرة بتتبع التوجيهات
 */
export async function resolveShortMapUrl(url: string): Promise<string> {
  if (!url || (!url.includes("goo.gl") && !url.includes("maps.app.goo.gl"))) {
    return url;
  }

  try {
    const res = await fetch(url, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      next: { revalidate: 86400 },
    });
    if (res.url && res.url !== url) {
      return res.url;
    }
  } catch {}

  return url;
}

/**
 * 3. استخراج الإحداثيات من صفحة embed للروابط التي لا تحتوي lat/lng في العنوان مباشرة
 */
export async function coordsFromMapsEmbed(url: string): Promise<GeoPoint | null> {
  if (!/^https?:\/\/[^\/]*google\.[^\/]*\//i.test(url)) {
    return null;
  }

  try {
    let embedUrl = url.replace(/([?&])output=[^&]*/, "$1").replace(/[?&]+$/, "");
    embedUrl += (embedUrl.includes("?") ? "&" : "?") + "output=embed";

    const res = await fetch(embedUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
      next: { revalidate: 86400 },
    });

    if (!res.ok) return null;
    const body = await res.text();
    if (!body) return null;

    // 1) نقطة المكان نفسه
    const m1 = body.match(/\[(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})\],"\d{8,}"/);
    if (m1) {
      const lat = parseFloat(m1[1]);
      const lng = parseFloat(m1[2]);
      if (isValidCoord(lat, lng)) return { lat, lng };
    }

    // 2) مركز الخريطة
    const m2 = body.match(/\[\[\[\d+\.\d+,(-?\d{1,3}\.\d{4,}),(-?\d{1,3}\.\d{4,})\]/);
    if (m2) {
      const lng = parseFloat(m2[1]);
      const lat = parseFloat(m2[2]);
      if (isValidCoord(lat, lng)) return { lat, lng };
    }

    // 3) صيغة pb
    const m3 = body.match(/!2d(-?\d{1,3}\.\d{4,})!3d(-?\d{1,3}\.\d{4,})/);
    if (m3) {
      const lng = parseFloat(m3[1]);
      const lat = parseFloat(m3[2]);
      if (isValidCoord(lat, lng)) return { lat, lng };
    }
  } catch {}

  return null;
}

/**
 * 4. الدالة الرئيسية: تحويل رابط الخريطة إلى إحداثيات (مضمونة ومطابقة لـ PHP)
 */
export async function expandMapUrlToCoords(url: string | null | undefined): Promise<GeoPoint | null> {
  if (!url) return null;
  const trimmed = url.trim();
  if (!trimmed) return null;

  // 1. فحص الإحداثيات مباشرة في الرابط
  const directCoords = parseCoordsFromLocationString(trimmed);
  if (directCoords) return directCoords;

  // 2. فك الرابط المختصر
  let resolved = trimmed;
  if (trimmed.includes("goo.gl")) {
    const short = await resolveShortMapUrl(trimmed);
    if (short && short !== trimmed) {
      const coords = parseCoordsFromLocationString(short);
      if (coords) return coords;
      resolved = short;
    }
  }

  // 3. محاولة استخراج الإحداثيات من صفحة Embed كحل أخير
  const embedCoords = await coordsFromMapsEmbed(resolved);
  if (embedCoords) return embedCoords;

  return null;
}
