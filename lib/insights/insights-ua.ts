/**
 * تحليل الـ User-Agent إلى جهاز/نظام/متصفح لصفحة «إحصائيات».
 *
 * ملف مستقل بالكامل عن `lib/activity-funnel.ts` عن قصد — تصنيف الأجهزة هنا أدقّ
 * (يفصل التابلت عن الجوال، ويستخرج النظام) وتغييره يجب ألا يحرّك أرقام `/admin/logs`.
 */

export type DeviceKind = "mobile" | "tablet" | "desktop" | "unknown";

export const DEVICE_KIND_LABELS: Record<DeviceKind, string> = {
  mobile: "جوال",
  tablet: "تابلت",
  desktop: "كمبيوتر",
  unknown: "غير معروف",
};

/**
 * ترتيب الفحص مقصود: الآيباد يعلن عن نفسه أحياناً كـ Macintosh مع لمس، وأندرويد
 * اللوحي هو ببساطة أندرويد **بدون** كلمة `Mobile`. لو قلبنا الترتيب صُنّف كل تابلت جوالاً.
 */
export function deviceKindOf(ua: string | null | undefined): DeviceKind {
  const s = (ua ?? "").toLowerCase();
  if (!s) return "unknown";
  if (/ipad|tablet|playbook|silk|kindle/.test(s)) return "tablet";
  if (/android/.test(s) && !/mobile/.test(s)) return "tablet";
  if (/mobi|iphone|ipod|windows phone|blackberry|opera mini/.test(s)) return "mobile";
  if (/windows|macintosh|mac os x|linux|cros|x11/.test(s)) return "desktop";
  return "unknown";
}

/** نظام التشغيل — يُفحص iOS/Android قبل Mac/Linux لأنهما يذكرانهما في نصّهما. */
export function osOf(ua: string | null | undefined): string {
  const s = (ua ?? "").toLowerCase();
  if (!s) return "غير معروف";
  if (/windows nt/.test(s)) return "Windows";
  if (/iphone|ipad|ipod|ios/.test(s)) return "iOS";
  if (/android/.test(s)) return "Android";
  if (/mac os x|macintosh/.test(s)) return "macOS";
  if (/cros/.test(s)) return "ChromeOS";
  if (/linux|x11|ubuntu/.test(s)) return "Linux";
  return "غير معروف";
}

/**
 * المتصفح. الترتيب حرج: كل المتصفحات المبنية على Chromium تكتب `Chrome` و`Safari`
 * في نصّها، فلا بد من استبعاد Edge/Opera/Samsung أولاً وإلا ظهرت كلها «Chrome».
 */
export function browserOf(ua: string | null | undefined): string {
  const s = ua ?? "";
  if (!s) return "غير معروف";
  if (/Edg[eA]?\//i.test(s)) return "Edge";
  if (/OPR\/|Opera/i.test(s)) return "Opera";
  if (/SamsungBrowser/i.test(s)) return "Samsung Internet";
  if (/FxiOS|Firefox/i.test(s)) return "Firefox";
  if (/CriOS/i.test(s)) return "Chrome";
  if (/Chrome\//i.test(s)) return "Chrome";
  if (/Safari\//i.test(s)) return "Safari";
  return "غير معروف";
}

/** وصف مختصر للجهاز يظهر بجوار اسم الموظف: «جوال · iOS · Safari». */
export function describeDevice(ua: string | null | undefined): string {
  return [DEVICE_KIND_LABELS[deviceKindOf(ua)], osOf(ua), browserOf(ua)]
    .filter((part) => part !== "غير معروف")
    .join(" · ");
}

/**
 * بوتات ومكتبات HTTP تُستبعد من إحصاءات العملاء. لا تُطبَّق على حركة لوحة التحكم
 * لأنها خلف تسجيل دخول أصلاً — لا يصلها بوت.
 */
const BOT_UA = /bot|crawler|spider|crawling|preview|lighthouse|headless|scrapy|semrush|ahrefs|mj12|dotbot|slurp|yandex|petalbot|applebot|facebookexternalhit|gptbot|ccbot|perplexity|python-requests|axios\/|node-fetch|go-http-client|okhttp|java\/|curl\/|wget/i;

export function isBotUa(ua: string | null | undefined): boolean {
  return !!ua && BOT_UA.test(ua);
}
