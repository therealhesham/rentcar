"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/admin-auth";
import { requireGalleryFolderSlug } from "@/lib/gallery-folder";
import {
  DEFAULT_HOME_HERO_IMAGE_URL,
  isAllowedHomeHeroImageUrl,
  SITE_KEY_HOME_HERO_IMAGE_ALT,
  SITE_KEY_HOME_HERO_IMAGE_URL,
} from "@/lib/site-settings";
import { prisma } from "@/lib/prisma";
import {
  isSpacesConfigured,
  isTrustedSpacesImageUrl,
  uploadImageToSpaces,
} from "@/lib/spaces-upload";

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
  if (!(await verifyAdminSession())) {
    return { ok: false, error: "غير مصرّح." };
  }

  const imageFile = formData.get("imageFile");
  const galleryImageUrl = String(formData.get("galleryImageUrl") ?? "").trim();
  const currentImage = String(formData.get("currentImage") ?? "").trim();
  const alt = String(formData.get("alt") ?? "").trim();

  if (!alt) {
    return { ok: false, error: "أدخل وصف الصورة (alt) لإتاحة الوصول." };
  }

  let imageUrl = currentImage;
  if (imageFile instanceof File && imageFile.size > 0) {
    if (!isSpacesConfigured()) {
      return {
        ok: false,
        error:
          "لم يُضبط تخزين Spaces في البيئة (SPACES_REGION، المفاتيح، SPACES_BUCKET).",
      };
    }
    try {
      await requireGalleryFolderSlug("home");
      imageUrl = await uploadImageToSpaces(imageFile, "home");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "فشل رفع الصورة.";
      return { ok: false, error: msg };
    }
  } else if (galleryImageUrl && isTrustedSpacesImageUrl(galleryImageUrl)) {
    imageUrl = galleryImageUrl;
  }

  if (!imageUrl) {
    imageUrl = DEFAULT_HOME_HERO_IMAGE_URL;
  }

  if (!isAllowedHomeHeroImageUrl(imageUrl)) {
    return {
      ok: false,
      error:
        "رابط الصورة الحالية غير مسموح. اختر صورة من المعرض أو ارفع ملفاً إلى Spaces، أو أعد تعيين الصورة الافتراضية من لوحة التحكم بعد إصلاح الرابط.",
    };
  }

  try {
    await upsertSiteSetting(SITE_KEY_HOME_HERO_IMAGE_URL, imageUrl);
    await upsertSiteSetting(SITE_KEY_HOME_HERO_IMAGE_ALT, alt);
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
