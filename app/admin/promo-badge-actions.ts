"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdminForAction } from "@/lib/admin-access";
import { normalizePromoBadgeSettings } from "@/lib/promo-badge";
import { prisma } from "@/lib/prisma";
import { SITE_KEY_PROMO_BADGE } from "@/lib/site-settings";

export async function updatePromoBadgeAction(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const carModelIds = [...new Set(formData.getAll("carModelIds").map((v) => Number(v)))].filter(
    (n) => Number.isInteger(n) && n > 0,
  );

  const settings = normalizePromoBadgeSettings({
    isActive: formData.get("isActive") === "on",
    labelAr: String(formData.get("labelAr") ?? ""),
    labelEn: String(formData.get("labelEn") ?? ""),
    backgroundColor: String(formData.get("backgroundColor") ?? ""),
    textColor: String(formData.get("textColor") ?? ""),
    carModelIds,
  });

  if (settings.isActive && settings.carModelIds.length === 0) {
    return { ok: false, error: "اختر موديلاً واحداً على الأقل قبل التفعيل." };
  }

  // تأكيد أن كل المعرّفات المُختارة لموديلات موجودة فعلاً — يحمي من قيم مزوَّرة في الفورم.
  if (settings.carModelIds.length > 0) {
    const found = await prisma.carModel.findMany({
      where: { id: { in: settings.carModelIds } },
      select: { id: true },
    });
    const validIds = new Set(found.map((f) => f.id));
    settings.carModelIds = settings.carModelIds.filter((id) => validIds.has(id));
  }

  try {
    await prisma.siteSetting.upsert({
      where: { key: SITE_KEY_PROMO_BADGE },
      create: { key: SITE_KEY_PROMO_BADGE, value: JSON.stringify(settings) },
      update: { value: JSON.stringify(settings) },
    });
  } catch {
    return { ok: false, error: "تعذّر حفظ الإعداد." };
  }

  revalidatePath("/admin/promo-badge");
  revalidatePath("/fleet");
  revalidatePath("/");
  return { ok: true };
}
