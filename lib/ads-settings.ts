import { prisma } from "@/lib/prisma";

/** مفتاح `SiteSetting` الذي يحمل إنفاق الحملات وأسماءها — لا يحتاج ترحيل قاعدة بيانات. */
export const SITE_KEY_ADS_PERFORMANCE = "ads_performance_v1";

export const MAX_ADS_SPEND_ENTRIES = 500;
export const MAX_ADS_CAMPAIGN_NAMES = 300;

export const AD_NETWORK_OPTIONS = [
  "Google Ads",
  "Meta",
  "TikTok",
  "Snapchat",
  "Microsoft Ads",
  "X (Twitter)",
] as const;

export type AdsSpendEntry = {
  id: string;
  network: string;
  /** مفتاح الحملة كما يظهر في اللوحة (رقم الحملة أو `utm_campaign`). فارغ = إنفاق على مستوى الشبكة كلها. */
  campaign: string;
  /** YYYY-MM-DD بتوقيت الرياض، شاملاً. */
  from: string;
  to: string;
  amountSar: number;
  /** نقرات أبلغت عنها المنصة لنفس الفترة — تتيح قياس نسبة ما التقطه الموقع من النقرات الفعلية. */
  clicks: number | null;
};

export type AdsSettings = {
  /** مفتاح الحملة → اسم مقروء. */
  campaignNames: Record<string, string>;
  spend: AdsSpendEntry[];
};

export const EMPTY_ADS_SETTINGS: AdsSettings = { campaignNames: {}, spend: [] };

const YMD = /^\d{4}-\d{2}-\d{2}$/;

function normalizeEntry(raw: unknown): AdsSpendEntry | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = typeof o.id === "string" ? o.id : "";
  const network = typeof o.network === "string" ? o.network.trim().slice(0, 40) : "";
  const campaign = typeof o.campaign === "string" ? o.campaign.trim().slice(0, 80) : "";
  const from = typeof o.from === "string" && YMD.test(o.from) ? o.from : "";
  const to = typeof o.to === "string" && YMD.test(o.to) ? o.to : "";
  const amountSar = Number(o.amountSar);
  if (!id || !network || !from || !to || to < from) return null;
  if (!Number.isFinite(amountSar) || amountSar < 0) return null;
  const clicksRaw = o.clicks == null ? null : Number(o.clicks);
  const clicks = clicksRaw != null && Number.isInteger(clicksRaw) && clicksRaw >= 0 ? clicksRaw : null;
  return { id, network, campaign, from, to, amountSar, clicks };
}

export function normalizeAdsSettings(raw: unknown): AdsSettings {
  if (!raw || typeof raw !== "object") return EMPTY_ADS_SETTINGS;
  const o = raw as Record<string, unknown>;

  const campaignNames: Record<string, string> = {};
  if (o.campaignNames && typeof o.campaignNames === "object" && !Array.isArray(o.campaignNames)) {
    for (const [key, value] of Object.entries(o.campaignNames as Record<string, unknown>)) {
      const k = key.trim().slice(0, 80);
      const v = typeof value === "string" ? value.trim().slice(0, 80) : "";
      if (k && v && Object.keys(campaignNames).length < MAX_ADS_CAMPAIGN_NAMES) campaignNames[k] = v;
    }
  }

  const spend = Array.isArray(o.spend)
    ? o.spend
        .map(normalizeEntry)
        .filter((e): e is AdsSpendEntry => e !== null)
        .slice(0, MAX_ADS_SPEND_ENTRIES)
    : [];

  return { campaignNames, spend };
}

export async function getAdsSettings(): Promise<AdsSettings> {
  try {
    const row = await prisma.siteSetting.findUnique({ where: { key: SITE_KEY_ADS_PERFORMANCE } });
    if (!row?.value) return EMPTY_ADS_SETTINGS;
    return normalizeAdsSettings(JSON.parse(row.value));
  } catch {
    return EMPTY_ADS_SETTINGS;
  }
}

export async function saveAdsSettings(settings: AdsSettings): Promise<void> {
  const value = JSON.stringify(normalizeAdsSettings(settings));
  await prisma.siteSetting.upsert({
    where: { key: SITE_KEY_ADS_PERFORMANCE },
    create: { key: SITE_KEY_ADS_PERFORMANCE, value },
    update: { value },
  });
}
