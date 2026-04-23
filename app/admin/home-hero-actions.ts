"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/admin-auth";
import { requireGalleryFolderSlug } from "@/lib/gallery-folder";
import {
  DEFAULT_HOME_HERO_LEFT_IMAGE_URL,
  DEFAULT_HOME_HERO_RIGHT_IMAGE_URL,
  isAllowedHomeHeroImageUrl,
  SITE_KEY_HOME_HERO_LEFT_IMAGE_ALT,
  SITE_KEY_HOME_HERO_LEFT_IMAGE_URL,
  SITE_KEY_HOME_HERO_RIGHT_IMAGE_ALT,
  SITE_KEY_HOME_HERO_RIGHT_IMAGE_URL,
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

async function resolveHeroImageUrl(opts: {
  imageFile: FormDataEntryValue | null;
  galleryImageUrl: string;
  currentImage: string;
  fallbackDefault: string;
}): Promise<{ ok: true; imageUrl: string } | { ok: false; error: string }> {
  const { imageFile, galleryImageUrl, currentImage, fallbackDefault } = opts;

  let imageUrl = currentImage.trim();

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
    imageUrl = fallbackDefault;
  }

  if (!isAllowedHomeHeroImageUrl(imageUrl)) {
    return {
      ok: false,
      error:
        "رابط إحدى الصور غير مسموح. اختر صورة من المعرض أو ارفع ملفاً إلى Spaces، أو استخدم الصورة الافتراضية.",
    };
  }

  return { ok: true, imageUrl };
}

export async function updateHomeHero(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await verifyAdminSession())) {
    return { ok: false, error: "غير مصرّح." };
  }

  const altLeft = String(formData.get("altLeft") ?? "").trim();
  const altRight = String(formData.get("altRight") ?? "").trim();

  if (!altLeft || !altRight) {
    return { ok: false, error: "أدخل وصفاً (alt) لكل من صورة اليسار واليمين." };
  }

  const leftResolved = await resolveHeroImageUrl({
    imageFile: formData.get("imageFileLeft"),
    galleryImageUrl: String(formData.get("galleryImageUrlLeft") ?? "").trim(),
    currentImage: String(formData.get("currentImageLeft") ?? "").trim(),
    fallbackDefault: DEFAULT_HOME_HERO_LEFT_IMAGE_URL,
  });
  if (!leftResolved.ok) {
    return { ok: false, error: leftResolved.error };
  }

  const rightResolved = await resolveHeroImageUrl({
    imageFile: formData.get("imageFileRight"),
    galleryImageUrl: String(formData.get("galleryImageUrlRight") ?? "").trim(),
    currentImage: String(formData.get("currentImageRight") ?? "").trim(),
    fallbackDefault: DEFAULT_HOME_HERO_RIGHT_IMAGE_URL,
  });
  if (!rightResolved.ok) {
    return { ok: false, error: rightResolved.error };
  }

  try {
    await upsertSiteSetting(SITE_KEY_HOME_HERO_LEFT_IMAGE_URL, leftResolved.imageUrl);
    await upsertSiteSetting(SITE_KEY_HOME_HERO_LEFT_IMAGE_ALT, altLeft);
    await upsertSiteSetting(SITE_KEY_HOME_HERO_RIGHT_IMAGE_URL, rightResolved.imageUrl);
    await upsertSiteSetting(SITE_KEY_HOME_HERO_RIGHT_IMAGE_ALT, altRight);
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
