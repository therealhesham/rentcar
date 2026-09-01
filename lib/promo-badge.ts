/**
 * شارات ترويجية على كارت السيارة — يديرها الأدمن من `/admin/promo-badge` كقائمة
 * «عروض» مستقلة: كل عرض له نص/ألوان/قائمة موديلات خاصة به، ويُفعَّل ويُعدَّل ويُحذَف
 * بمعزل عن العروض التانية — يسمح بتشغيل أكتر من عرض في نفس الوقت على سيارات مختلفة
 * (مثلاً: عرض أخضر لليوم الوطني على موديلات، وعرض تاني بلون مختلف على موديلات غيرها).
 *
 * كارت السيارة بيحل أول عرض *مفعَّل* شامل الموديل ده — لا تكديس. عرض غير مفعَّل أو
 * بلا موديلات مختارة مالوش أي أثر، فيرجع الكارت لشارة «وفّرت/خصم» الافتراضية تلقائياً.
 */
export type PromoBadgeCampaign = {
  id: string;
  isActive: boolean;
  labelAr: string;
  labelEn: string;
  backgroundColor: string;
  textColor: string;
  carModelIds: number[];
};

export type PromoBadgeSettings = {
  campaigns: PromoBadgeCampaign[];
};

export const DEFAULT_PROMO_BADGE_SETTINGS: PromoBadgeSettings = {
  campaigns: [],
};

const HEX_COLOR_RE = /^#[0-9a-fA-F]{6}$/;

export function isValidHexColor(value: string): boolean {
  return HEX_COLOR_RE.test(value.trim());
}

function normalizeCampaign(raw: unknown): PromoBadgeCampaign | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;

  const id = typeof o.id === "string" ? o.id.trim() : "";
  if (!id) return null;

  const labelAr = typeof o.labelAr === "string" ? o.labelAr.trim().slice(0, 40) : "";
  const labelEn = typeof o.labelEn === "string" ? o.labelEn.trim().slice(0, 40) : "";

  const backgroundColorRaw = typeof o.backgroundColor === "string" ? o.backgroundColor.trim() : "";
  const backgroundColor = isValidHexColor(backgroundColorRaw) ? backgroundColorRaw : "#006C35";

  const textColorRaw = typeof o.textColor === "string" ? o.textColor.trim() : "";
  const textColor = isValidHexColor(textColorRaw) ? textColorRaw : "#FFFFFF";

  const carModelIds = Array.isArray(o.carModelIds)
    ? [...new Set(o.carModelIds.map((n) => Number(n)).filter((n) => Number.isInteger(n) && n > 0))]
    : [];

  return {
    id,
    isActive: Boolean(o.isActive) && labelAr.length > 0 && carModelIds.length > 0,
    labelAr,
    labelEn,
    backgroundColor,
    textColor,
    carModelIds,
  };
}

export function normalizePromoBadgeSettings(raw: unknown): PromoBadgeSettings {
  if (!raw || typeof raw !== "object") return { campaigns: [] };
  const o = raw as Record<string, unknown>;
  if (!Array.isArray(o.campaigns)) return { campaigns: [] };
  const campaigns = o.campaigns
    .map((c) => normalizeCampaign(c))
    .filter((c): c is PromoBadgeCampaign => c !== null);
  return { campaigns };
}

/** أول عرض مفعَّل شامل هذا الموديل — null = يبقى السلوك الافتراضي (وفّرت/خصم). */
export function resolvePromoBadgeForModel(
  settings: PromoBadgeSettings,
  modelId: number,
): { labelAr: string; labelEn: string; backgroundColor: string; textColor: string } | null {
  const campaign = settings.campaigns.find((c) => c.isActive && c.carModelIds.includes(modelId));
  if (!campaign) return null;
  return {
    labelAr: campaign.labelAr,
    labelEn: campaign.labelEn || campaign.labelAr,
    backgroundColor: campaign.backgroundColor,
    textColor: campaign.textColor,
  };
}
