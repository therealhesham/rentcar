/**
 * مصدر الزيارة (Meta / TikTok / Snapchat / Google ...) القادم من رابط الحملة `?_source=meta`.
 * بيتلقط في `middleware.ts` ويتحفظ في كوكي 30 يوم، وبعدين بيتقرا على الخادم لحظة إنشاء
 * طلب أو تسجيل ضغطة عشان يتنسب للمصدر الصح في GoWeb بدل `website` الثابت.
 *
 * الملف ده بدون imports من Node عشان يشتغل في Edge (middleware).
 */

export const GOWEB_SOURCE_COOKIE = "rw_source";
export const GOWEB_SOURCE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/** حروف صغيرة وأرقام و`-` و`_` فقط؛ أي قيمة غير ذلك تُهمل (حماية من الحقن). */
const SOURCE_RE = /^[a-z0-9_-]{1,40}$/;

export function sanitizeGowebSource(raw: string | null | undefined): string | null {
  const v = raw?.trim().toLowerCase();
  return v && SOURCE_RE.test(v) ? v : null;
}

/** يقرأ مصدر الزائر الحالي من الكوكي (خادم فقط). null لو مفيش أو خارج سياق طلب. */
export async function getStoredGowebSource(): Promise<string | null> {
  try {
    const { cookies } = await import("next/headers");
    const jar = await cookies();
    return sanitizeGowebSource(jar.get(GOWEB_SOURCE_COOKIE)?.value);
  } catch {
    return null;
  }
}
