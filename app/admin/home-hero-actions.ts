"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdminForAction } from "@/lib/admin-access";
import { resolveUploadedImageUrl } from "@/lib/admin-image-resolve";
import {
  DEFAULT_HOME_HERO_IMAGE_URL,
  isAllowedHomeHeroImageUrl,
  SITE_KEY_HOME_HERO_IMAGE_ALT,
  SITE_KEY_HOME_HERO_IMAGE_URL,
} from "@/lib/site-settings";
import { prisma } from "@/lib/prisma";

async function upsertSiteSetting(key: string, value: string): Promise<void> {
  await prisma.siteSetting.upsert({
    where: { key },
    create: { key, value },
    update: { value },
  });
}

export async function updateHomeHero(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const imageAlt = String(formData.get("imageAlt") ?? "").trim();
  if (!imageAlt) {
    return { ok: false, error: "أدخل وصفاً (alt) لصورة الهيرو." };
  }

  const resolved = await resolveUploadedImageUrl({
    imageFile: formData.get("imageFile"),
    galleryImageUrl: String(formData.get("galleryImageUrl") ?? "").trim(),
    currentImage: String(formData.get("currentImage") ?? "").trim(),
    fallbackDefault: DEFAULT_HOME_HERO_IMAGE_URL,
    isAllowedUrl: isAllowedHomeHeroImageUrl,
    folderSlug: "home",
    folderLabel: "الصفحة الرئيسية (هيرو)",
  });
  if (!resolved.ok) {
    return { ok: false, error: resolved.error };
  }

  try {
    await upsertSiteSetting(SITE_KEY_HOME_HERO_IMAGE_URL, resolved.imageUrl);
    await upsertSiteSetting(SITE_KEY_HOME_HERO_IMAGE_ALT, imageAlt);
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

  revalidatePath("/");
  revalidatePath("/admin/home");
  return { ok: true };
}
