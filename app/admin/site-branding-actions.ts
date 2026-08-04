"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdminForAction } from "@/lib/admin-access";
import { resolveUploadedImageUrl } from "@/lib/admin-image-resolve";
import { prisma } from "@/lib/prisma";
import {
  DEFAULT_SITE_BRANDING,
  SITE_BRANDING_SETTING_KEYS,
  SITE_BRANDING_SLOT_LABELS_AR,
  SITE_BRANDING_SLOTS,
  type SiteBrandingSlot,
} from "@/lib/site-branding";
import { isAllowedSiteBrandingUrl } from "@/lib/site-settings";

const FOLDER_SLUG = "site-branding";
const FOLDER_LABEL = "شعارات الموقع";

async function upsertSiteSetting(key: string, value: string): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function updateSiteBranding(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const resolvedBySlot: Partial<Record<SiteBrandingSlot, string>> = {};

  for (const slot of SITE_BRANDING_SLOTS) {
    const resolved = await resolveUploadedImageUrl({
      imageFile: formData.get(`imageFile_${slot}`),
      galleryImageUrl: String(formData.get(`galleryImageUrl_${slot}`) ?? "").trim(),
      currentImage: String(formData.get(`currentImage_${slot}`) ?? "").trim(),
      fallbackDefault: DEFAULT_SITE_BRANDING[slot],
      isAllowedUrl: isAllowedSiteBrandingUrl,
      folderSlug: FOLDER_SLUG,
      folderLabel: FOLDER_LABEL,
    });
    if (!resolved.ok) {
      return { ok: false, error: `${SITE_BRANDING_SLOT_LABELS_AR[slot]}: ${resolved.error}` };
    }
    resolvedBySlot[slot] = resolved.imageUrl;
  }

  try {
    for (const slot of SITE_BRANDING_SLOTS) {
      await upsertSiteSetting(SITE_BRANDING_SETTING_KEYS[slot], resolvedBySlot[slot]!);
    }
  } catch (e: unknown) {
    console.error(e);
    const code =
      e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
    if (code === "P2021") {
      return {
        ok: false,
        error:
          "جدول إعدادات الموقع غير موجود. نفّذ تحديث قاعدة البيانات (مثلاً: npx prisma db push) ثم أعد المحاولة.",
      };
    }
    return { ok: false, error: "تعذّر حفظ الإعدادات." };
  }

  // الشعار يظهر في هيدر وفوتر كل صفحات الموقع، لذا يُبطَل الكاش من الجذر.
  revalidatePath("/", "layout");
  revalidatePath("/admin/site-branding");
  return { ok: true };
}
