/**
 * معرّف نقرة إعلانات Google (GCLID). يُلتقط في `middleware.ts` من `?gclid=` ويُحفظ في كوكي
 * 90 يوماً، ثم يُقرأ على الخادم لحظة إنشاء الحجز أو الرسالة ليُخزَّن بجوار بيانات العميل
 * ويُصدَّر لاحقاً لرفع الإحالات دون اتصال (Offline Conversions).
 */

export const GCLID_COOKIE = "rw_gclid";
export const GCLID_MAX_AGE_SECONDS = 90 * 24 * 60 * 60;

/** GCLID يتكوّن من حروف وأرقام و`-` و`_` فقط؛ أي قيمة غير ذلك تُهمل (حماية من الحقن). */
const GCLID_RE = /^[A-Za-z0-9_-]{10,200}$/;

export function sanitizeGclid(raw: string | null | undefined): string | null {
  const v = raw?.trim();
  return v && GCLID_RE.test(v) ? v : null;
}

/** يقرأ GCLID المحفوظ من كوكي الزائر الحالي (خادم فقط). يعيد null خارج سياق طلب. */
export async function getStoredGclid(): Promise<string | null> {
  try {
    const { cookies } = await import("next/headers");
    const jar = await cookies();
    return sanitizeGclid(jar.get(GCLID_COOKIE)?.value);
  } catch {
    return null;
  }
}
