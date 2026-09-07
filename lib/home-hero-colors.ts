import { isValidHexColor } from "@/lib/promo-badge";

/**
 * ألوان نصوص هيرو الصفحة الرئيسية — يضبطها المسؤول من `/admin/home`.
 * القيم الافتراضية هي ألوان التصميم الأصلي حرفياً، فالإعداد الفارغ لا يغيّر شيئاً.
 */
export type HomeHeroColors = {
  /** العنوان الرئيسي */
  titleColor: string;
  /** السطر الفرعي — يُرسم بشفافية ٨٠٪ فوق الخلفية */
  subtitleColor: string;
  /** النص الصغير فوق العنوان */
  eyebrowTextColor: string;
  /** الخطان الذهبيان حول النص العلوي */
  eyebrowLineColor: string;
  /** نص شارات الثقة أسفل نموذج البحث */
  trustTextColor: string;
  /** أيقونات شارات الثقة */
  trustIconColor: string;
};

export const DEFAULT_HOME_HERO_COLORS: HomeHeroColors = {
  titleColor: "#003749",
  subtitleColor: "#0F3D47",
  eyebrowTextColor: "#A8874F",
  eyebrowLineColor: "#C9A356",
  trustTextColor: "#0F3D47",
  trustIconColor: "#C9A356",
};

export const HOME_HERO_COLOR_KEYS = Object.keys(
  DEFAULT_HOME_HERO_COLORS,
) as (keyof HomeHeroColors)[];

/** كل لون غير صالح يسقط على قيمته الافتراضية وحده — لا يُهدر باقي الإعداد. */
export function normalizeHomeHeroColors(raw: unknown): HomeHeroColors {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_HOME_HERO_COLORS };
  const o = raw as Record<string, unknown>;

  const colors = { ...DEFAULT_HOME_HERO_COLORS };
  for (const key of HOME_HERO_COLOR_KEYS) {
    const value = typeof o[key] === "string" ? (o[key] as string).trim() : "";
    if (isValidHexColor(value)) colors[key] = value.toUpperCase();
  }
  return colors;
}
