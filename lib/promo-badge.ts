/**
 * شارة ترويجية عامة على كارت السيارة — يديرها الأدمن بالكامل من `/admin/promo-badge`:
 * نص، لون خلفية، لون نص، وقائمة موديلات صريحة يُطبَّق عليها. تحل محل شارة
 * «وفّرت/خصم» الحمراء على الموديلات المختارة فقط طالما مفعَّلة، وإلا يبقى السلوك
 * الافتراضي (`discountLabel`) كما هو — لا حاجة لأي كود إضافي عند إيقافها.
 */
export type PromoBadgeSettings = {
  isActive: boolean;
  labelAr: string;
  labelEn: string;
  backgroundColor: string;
  textColor: string;
  carModelIds: number[];
};

export const DEFAULT_PROMO_BADGE_SETTINGS: PromoBadgeSettings = {
  isActive: false,
  labelAr: "",
  labelEn: "",
  backgroundColor: "#006C35",
  textColor: "#FFFFFF",
  carModelIds: [],
};

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR_RE.test(value.trim());
}

export function normalizePromoBadgeSettings(raw: unknown): PromoBadgeSettings {
  if (!raw || typeof raw !== "object") return { ...DEFAULT_PROMO_BADGE_SETTINGS };
  const o = raw as Record<string, unknown>;

  const labelAr = typeof o.labelAr === "string" ? o.labelAr.trim().slice(0, 40) : "";
  const labelEn = typeof o.labelEn === "string" ? o.labelEn.trim().slice(0, 40) : "";

  const backgroundColorRaw = typeof o.backgroundColor === "string" ? o.backgroundColor.trim() : "";
  const backgroundColor = isValidHexColor(backgroundColorRaw)
    ? backgroundColorRaw
    : DEFAULT_PROMO_BADGE_SETTINGS.backgroundColor;

  const textColorRaw = typeof o.textColor === "string" ? o.textColor.trim() : "";
  const textColor = isValidHexColor(textColorRaw) ? textColorRaw : DEFAULT_PROMO_BADGE_SETTINGS.textColor;

  const carModelIds = Array.isArray(o.carModelIds)
    ? [...new Set(o.carModelIds.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0))]
    : [];

  return {
    isActive: Boolean(o.isActive) && labelAr.length > 0,
    labelAr,
    labelEn,
    backgroundColor,
    textColor,
    carModelIds,
  };
}

/** يحسم هل تظهر الشارة على موديل مُعيَّن، وبأي نص/ألوان — null = يبقى السلوك الافتراضي. */
export function resolvePromoBadgeForModel(
  settings: PromoBadgeSettings,
  modelId: number,
): { labelAr: string; labelEn: string; backgroundColor: string; textColor: string } | null {
  if (!settings.isActive) return null;
  if (!settings.labelAr) return null;
  if (!settings.carModelIds.includes(modelId)) return null;
  return {
    labelAr: settings.labelAr,
    labelEn: settings.labelEn || settings.labelAr,
    backgroundColor: settings.backgroundColor,
    textColor: settings.textColor,
  };
}
