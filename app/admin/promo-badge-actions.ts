"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { requireSuperAdminForAction } from "@/lib/admin-access";
import { normalizePromoBadgeSettings, type PromoBadgeCampaign } from "@/lib/promo-badge";
import { prisma } from "@/lib/prisma";
import { SITE_KEY_PROMO_BADGE, getPromoBadgeSettings } from "@/lib/site-settings";

export type PromoBadgeActionResult = { ok: boolean; error?: string };

/**
 * الصفحات `force-dynamic` فلا يوجد تخزين مؤقت خادمي، لكن `revalidatePath` لازم
 * يستهدف المسار الفعلي شاملاً بادئة اللغة (`/ar/fleet`) — تمريره بلا بادئة لا يطابق
 * مسار ديناميكي تحت `[locale]`.
 */
function revalidatePromoBadgeSurfaces() {
  revalidatePath("/admin/promo-badge");
  revalidatePath("/ar/fleet");
  revalidatePath("/en/fleet");
  revalidatePath("/ar");
  revalidatePath("/en");
}

async function persistCampaigns(campaigns: PromoBadgeCampaign[]): Promise<void> {
  const value = JSON.stringify({ campaigns });
  await prisma.siteSetting.upsert({
    where: { key: SITE_KEY_PROMO_BADGE },
    create: { key: SITE_KEY_PROMO_BADGE, value },
    update: { value },
  });
}

/** إنشاء أو تحديث عرض واحد بمعزل عن باقي العروض المحفوظة. */
export async function savePromoBadgeCampaignAction(
  _prev: PromoBadgeActionResult | null,
  formData: FormData,
): Promise<PromoBadgeActionResult> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const id = String(formData.get("id") ?? "").trim() || randomUUID();
  const isActiveRaw = formData.get("isActive") === "on";
  const labelArRaw = String(formData.get("labelAr") ?? "").trim();
  const carModelIds = [...new Set(formData.getAll("carModelIds").map((v) => Number(v)))].filter(
    (n) => Number.isInteger(n) && n > 0,
  );

  if (isActiveRaw && !labelArRaw) {
    return { ok: false, error: "اكتب نص الشارة قبل التفعيل." };
  }
  if (isActiveRaw && carModelIds.length === 0) {
    return { ok: false, error: "اختر موديلاً واحداً على الأقل قبل التفعيل." };
  }

  const normalized = normalizePromoBadgeSettings({
    campaigns: [
      {
        id,
        isActive: isActiveRaw,
        labelAr: labelArRaw,
        labelEn: String(formData.get("labelEn") ?? ""),
        backgroundColor: String(formData.get("backgroundColor") ?? ""),
        textColor: String(formData.get("textColor") ?? ""),
        carModelIds,
      },
    ],
  }).campaigns[0];
  if (!normalized) {
    return { ok: false, error: "تعذّر حفظ العرض." };
  }

  // تأكيد أن المعرّفات المُختارة لموديلات موجودة فعلاً — يحمي من قيم مزوَّرة في الفورم.
  let validatedIds = normalized.carModelIds;
  if (validatedIds.length > 0) {
    const found = await prisma.carModel.findMany({
      where: { id: { in: validatedIds } },
      select: { id: true },
    });
    const validSet = new Set(found.map((f) => f.id));
    validatedIds = validatedIds.filter((mid) => validSet.has(mid));
  }
  const campaign: PromoBadgeCampaign = { ...normalized, carModelIds: validatedIds };

  try {
    const current = await getPromoBadgeSettings();
    const idx = current.campaigns.findIndex((c) => c.id === campaign.id);
    const campaigns =
      idx >= 0
        ? current.campaigns.map((c, i) => (i === idx ? campaign : c))
        : [...current.campaigns, campaign];
    await persistCampaigns(campaigns);
  } catch {
    return { ok: false, error: "تعذّر حفظ العرض." };
  }

  revalidatePromoBadgeSurfaces();
  return { ok: true };
}

/** حذف عرض واحد بمعرّفه — بلا أثر على باقي العروض. */
export async function deletePromoBadgeCampaignAction(campaignId: string): Promise<PromoBadgeActionResult> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  try {
    const current = await getPromoBadgeSettings();
    const campaigns = current.campaigns.filter((c) => c.id !== campaignId);
    await persistCampaigns(campaigns);
  } catch {
    return { ok: false, error: "تعذّر حذف العرض." };
  }

  revalidatePromoBadgeSurfaces();
  return { ok: true };
}
