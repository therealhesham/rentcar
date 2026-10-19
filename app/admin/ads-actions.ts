"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requirePermissionForAction } from "@/lib/admin-access";
import {
  MAX_ADS_CAMPAIGN_NAMES,
  MAX_ADS_SPEND_ENTRIES,
  getAdsSettings,
  saveAdsSettings,
} from "@/lib/ads-settings";

export type AdsActionResult = { ok: boolean; error?: string };

const PAGE_PERMISSION = "/admin/ads";
const YMD = /^\d{4}-\d{2}-\d{2}$/;

function str(formData: FormData, name: string, max: number): string {
  return String(formData.get(name) ?? "").trim().slice(0, max);
}

export async function saveAdsSpendAction(
  _prev: AdsActionResult | null,
  formData: FormData,
): Promise<AdsActionResult> {
  const auth = await requirePermissionForAction(PAGE_PERMISSION);
  if (!auth.ok) return { ok: false, error: auth.error };

  const network = str(formData, "network", 40);
  const campaign = str(formData, "campaign", 80);
  const from = str(formData, "from", 10);
  const to = str(formData, "to", 10);
  const amountSar = Number(str(formData, "amountSar", 16));
  const clicksRaw = str(formData, "clicks", 12);
  const clicks = clicksRaw === "" ? null : Number(clicksRaw);

  if (!network) return { ok: false, error: "اختر الشبكة الإعلانية." };
  if (!YMD.test(from) || !YMD.test(to)) return { ok: false, error: "حدّد تاريخ البداية والنهاية." };
  if (to < from) return { ok: false, error: "تاريخ النهاية قبل البداية." };
  if (!Number.isFinite(amountSar) || amountSar < 0 || amountSar > 10_000_000) {
    return { ok: false, error: "مبلغ الإنفاق غير صالح." };
  }
  if (clicks != null && (!Number.isInteger(clicks) || clicks < 0 || clicks > 100_000_000)) {
    return { ok: false, error: "عدد النقرات يجب أن يكون رقماً صحيحاً." };
  }

  const settings = await getAdsSettings();
  if (settings.spend.length >= MAX_ADS_SPEND_ENTRIES) {
    return { ok: false, error: "بلغت الحد الأقصى لعدد قيود الإنفاق — احذف القديم منها." };
  }
  await saveAdsSettings({
    ...settings,
    spend: [...settings.spend, { id: randomUUID(), network, campaign, from, to, amountSar, clicks }],
  });
  revalidatePath("/admin/ads");
  return { ok: true };
}

export async function deleteAdsSpendAction(id: string): Promise<AdsActionResult> {
  const auth = await requirePermissionForAction(PAGE_PERMISSION);
  if (!auth.ok) return { ok: false, error: auth.error };
  const settings = await getAdsSettings();
  await saveAdsSettings({ ...settings, spend: settings.spend.filter((e) => e.id !== id) });
  revalidatePath("/admin/ads");
  return { ok: true };
}

/** اسم فارغ = حذف التسمية. */
export async function saveCampaignNameAction(
  _prev: AdsActionResult | null,
  formData: FormData,
): Promise<AdsActionResult> {
  const auth = await requirePermissionForAction(PAGE_PERMISSION);
  if (!auth.ok) return { ok: false, error: auth.error };

  const key = str(formData, "key", 80);
  const name = str(formData, "name", 80);
  if (!key) return { ok: false, error: "اكتب رقم الحملة أو معرّفها." };

  const settings = await getAdsSettings();
  const names = { ...settings.campaignNames };
  if (name) {
    if (!(key in names) && Object.keys(names).length >= MAX_ADS_CAMPAIGN_NAMES) {
      return { ok: false, error: "بلغت الحد الأقصى لعدد التسميات." };
    }
    names[key] = name;
  } else {
    delete names[key];
  }
  await saveAdsSettings({ ...settings, campaignNames: names });
  revalidatePath("/admin/ads");
  return { ok: true };
}
