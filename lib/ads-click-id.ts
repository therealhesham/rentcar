/**
 * معرّفات نقرة إعلانات Google: `gclid` (الويب)، و`gbraid`/`wbraid` (iOS بعد قيود الخصوصية).
 * تُلتقط في `middleware.ts` من رابط الزيارة وتُحفظ في كوكي 90 يوماً، ثم تُقرأ على الخادم
 * لحظة إنشاء الحجز أو الرسالة لتُخزَّن بجوار بيانات العميل وتُصدَّر لرفع الإحالات دون اتصال.
 */

export const ADS_CLICK_ID_KEYS = ["gclid", "gbraid", "wbraid"] as const;
export type AdsClickIdKey = (typeof ADS_CLICK_ID_KEYS)[number];
export type AdsClickIds = Record<AdsClickIdKey, string | null>;

export const ADS_CLICK_ID_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

export function adsClickIdCookieName(key: AdsClickIdKey): string {
  return `rw_${key}`;
}

/** حروف وأرقام و`-` و`_` فقط؛ أي قيمة غير ذلك تُهمل (حماية من الحقن). */
const CLICK_ID_RE = /^[A-Za-z0-9_-]{10,200}$/;

export function sanitizeClickId(raw: string | null | undefined): string | null {
  const v = raw?.trim();
  return v && CLICK_ID_RE.test(v) ? v : null;
}

/** يقرأ معرّفات النقرة المحفوظة في كوكي الزائر الحالي (خادم فقط). null لكل معرّف غائب أو خارج سياق طلب. */
export async function getStoredAdsClickIds(): Promise<AdsClickIds> {
  const out: AdsClickIds = { gclid: null, gbraid: null, wbraid: null };
  try {
    const { cookies } = await import("next/headers");
    const jar = await cookies();
    for (const key of ADS_CLICK_ID_KEYS) {
      out[key] = sanitizeClickId(jar.get(adsClickIdCookieName(key))?.value);
    }
  } catch {
    /* خارج سياق طلب */
  }
  return out;
}
