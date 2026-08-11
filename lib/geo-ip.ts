import "server-only";
import { join } from "node:path";
import type { CityResponse, Reader } from "maxmind";

/**
 * تحديد موقع الزائر من عنوانه عبر قاعدة MaxMind GeoLite2 **محلياً** — لا طلبات
 * خارجية ولا حدود معدّل، وعناوين الزوار لا تغادر الخادم.
 *
 * القاعدة غير مرفوعة في المستودع (~60MB). نزّلها بـ `npm run geo:update`.
 * لو الملف غير موجود تعود الدوال بـ `null` بدل أن ترمي — الخريطة تختفي والصفحة
 * تعمل كالمعتاد.
 */

const DB_PATH = join(process.cwd(), "data", "GeoLite2-City.mmdb");

/**
 * GeoLite2 لا تحمل أسماء عربية (اللغات المتاحة: en, de, es, fr, ja, pt-BR, ru, zh-CN)،
 * فنعرّب ما يهمّنا يدوياً — مدن السعودية ودول الخليج التي يأتي منها الزوار عادةً.
 * أي اسم خارج القائمة يُعرض بالإنجليزية كما ورد.
 */
const AR_PLACE_NAMES: Record<string, string> = {
  Riyadh: "الرياض",
  Jeddah: "جدة",
  Mecca: "مكة المكرمة",
  Makkah: "مكة المكرمة",
  Medina: "المدينة المنورة",
  Madinah: "المدينة المنورة",
  Dammam: "الدمام",
  Khobar: "الخبر",
  "Al Khobar": "الخبر",
  Dhahran: "الظهران",
  Tabuk: "تبوك",
  Yanbu: "ينبع",
  Buraidah: "بريدة",
  Abha: "أبها",
  "Khamis Mushait": "خميس مشيط",
  Taif: "الطائف",
  "Ha'il": "حائل",
  Hail: "حائل",
  Jubail: "الجبيل",
  Najran: "نجران",
  Jazan: "جازان",
  "Saudi Arabia": "السعودية",
  Kuwait: "الكويت",
  "Kuwait City": "مدينة الكويت",
  Bahrain: "البحرين",
  Manama: "المنامة",
  Qatar: "قطر",
  Doha: "الدوحة",
  "United Arab Emirates": "الإمارات",
  Dubai: "دبي",
  "Abu Dhabi": "أبوظبي",
  Sharjah: "الشارقة",
  Oman: "عُمان",
  Muscat: "مسقط",
  Egypt: "مصر",
  Cairo: "القاهرة",
  Jordan: "الأردن",
  Amman: "عمّان",
  Yemen: "اليمن",
  Sudan: "السودان",
  Algeria: "الجزائر",
  Morocco: "المغرب",
  Tunisia: "تونس",
  Lebanon: "لبنان",
  Iraq: "العراق",
  Syria: "سوريا",
  Pakistan: "باكستان",
  India: "الهند",
  Bangladesh: "بنغلاديش",
  Philippines: "الفلبين",
  Turkey: "تركيا",
  "United States": "الولايات المتحدة",
  "United Kingdom": "المملكة المتحدة",
  Germany: "ألمانيا",
  France: "فرنسا",
};

const toArabic = (name: string | undefined | null): string | null =>
  name ? (AR_PLACE_NAMES[name] ?? name) : null;

export type GeoLocation = {
  city: string | null;
  country: string | null;
  countryCode: string | null;
  lat: number;
  lng: number;
};

type LoadState = { reader: Reader<CityResponse> | null; missing: boolean };

let loading: Promise<LoadState> | null = null;

/** تحميل القاعدة مرة واحدة لكل عملية — القارئ يحتفظ بالملف مفتوحاً ومفهرساً. */
function loadReader(): Promise<LoadState> {
  loading ??= (async () => {
    try {
      const maxmind = await import("maxmind");
      const reader = await maxmind.open<CityResponse>(DB_PATH);
      return { reader, missing: false };
    } catch {
      // أشهر سبب: الملف غير منزَّل بعد. نسجّل مرة واحدة لا مع كل طلب.
      console.warn(
        `geo-ip: قاعدة GeoLite2 غير متاحة في ${DB_PATH} — شغّل \`npm run geo:update\`. الخريطة معطّلة.`,
      );
      return { reader: null, missing: true };
    }
  })();
  return loading;
}

/** هل القاعدة جاهزة؟ تستخدمها الواجهة لتعرض إرشاد التنزيل بدل خريطة فارغة. */
export async function isGeoDatabaseReady(): Promise<boolean> {
  const { reader } = await loadReader();
  return reader !== null;
}

/**
 * العناوين المحلية والخاصة لا معنى لتحديد موقعها — تُستبعد مبكراً حتى لا تظهر
 * كنقاط وهمية على الخريطة.
 */
function isPrivateIp(ip: string): boolean {
  if (ip === "::1" || ip.startsWith("127.") || ip.startsWith("::ffff:127.")) return true;
  if (ip.startsWith("10.") || ip.startsWith("192.168.")) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (/^f[cd]/i.test(ip)) return true; // نطاقات IPv6 المحلية الفريدة
  return false;
}

export async function lookupIp(ip: string | null | undefined): Promise<GeoLocation | null> {
  const value = ip?.trim();
  if (!value || isPrivateIp(value)) return null;

  const { reader } = await loadReader();
  if (!reader) return null;

  let row: CityResponse | null;
  try {
    row = reader.get(value);
  } catch {
    return null; // عنوان غير صالح الصيغة
  }
  if (!row?.location) return null;

  const { latitude, longitude } = row.location;
  if (typeof latitude !== "number" || typeof longitude !== "number") return null;

  return {
    city: toArabic(row.city?.names?.en),
    country: toArabic(row.country?.names?.en),
    countryCode: row.country?.iso_code ?? null,
    lat: latitude,
    lng: longitude,
  };
}

export type GeoCluster = {
  key: string;
  label: string;
  country: string | null;
  countryCode: string | null;
  lat: number;
  lng: number;
  sessions: number;
  /** عدد الجلسات التي وصلت صفحة الحجز — يلوّن النقطة على الخريطة. */
  reachedCheckout: number;
};

/**
 * تجميع الجلسات في نقاط حسب المدينة. المفتاح هو المدينة+الدولة لا الإحداثيات،
 * لأن MaxMind تعطي إحداثيات مختلفة قليلاً لعناوين من نفس المدينة فتتفتّت النقاط.
 */
export async function clusterSessionsByCity(
  sessions: ReadonlyArray<{ ip: string | null; reachedCheckout: boolean }>,
): Promise<GeoCluster[]> {
  const clusters = new Map<string, GeoCluster>();

  for (const session of sessions) {
    const geo = await lookupIp(session.ip);
    if (!geo) continue;

    const label = geo.city ?? geo.country ?? "غير معروف";
    const key = `${label}|${geo.countryCode ?? ""}`;
    const existing = clusters.get(key);
    if (existing) {
      existing.sessions++;
      if (session.reachedCheckout) existing.reachedCheckout++;
      continue;
    }
    clusters.set(key, {
      key,
      label,
      country: geo.country,
      countryCode: geo.countryCode,
      lat: geo.lat,
      lng: geo.lng,
      sessions: 1,
      reachedCheckout: session.reachedCheckout ? 1 : 0,
    });
  }

  return [...clusters.values()].sort((a, b) => b.sessions - a.sessions);
}
