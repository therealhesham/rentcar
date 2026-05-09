"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/admin-auth";
import { ensureGalleryFolderSlug } from "@/lib/gallery-folder";
import { prisma } from "@/lib/prisma";
import {
  isAllowedPromoBannerImageUrl,
  SITE_KEY_PROMO_BANNER_SLIDES,
  type PromoBannerSlide,
} from "@/lib/site-settings";
import {
  isSpacesConfigured,
  isTrustedSpacesImageUrl,
  uploadImageToSpaces,
} from "@/lib/spaces-upload";

const MAX_SLIDES = 5;

async function resolveSlideImage(opts: {
  imageFile: FormDataEntryValue | null;
  galleryUrl: string;
  currentImage: string;
}): Promise<{ ok: true; imageUrl: string } | { ok: false; error: string }> {
  const { imageFile, galleryUrl, currentImage } = opts;
  let imageUrl = currentImage.trim();

  if (imageFile instanceof File && imageFile.size > 0) {
    if (!isSpacesConfigured()) {
      return { ok: false, error: "لم يُضبط تخزين Spaces في البيئة." };
    }
    try {
      await ensureGalleryFolderSlug("promo", "البانر الترويجي");
      imageUrl = await uploadImageToSpaces(imageFile, "promo");
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "فشل رفع الصورة." };
    }
  } else if (galleryUrl && isTrustedSpacesImageUrl(galleryUrl)) {
    imageUrl = galleryUrl;
  }

  if (imageUrl && !isAllowedPromoBannerImageUrl(imageUrl)) {
    return { ok: false, error: `رابط الصورة غير مسموح: ${imageUrl.slice(0, 60)}` };
  }

  return { ok: true, imageUrl };
}

export async function updatePromoBanner(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await verifyAdminSession())) {
    return { ok: false, error: "غير مصرّح." };
  }

  const slides: PromoBannerSlide[] = [];

  for (let i = 0; i < MAX_SLIDES; i++) {
    const currentImage = String(formData.get(`currentImage_${i}`) ?? "").trim();
    const galleryUrl   = String(formData.get(`galleryImageUrl_${i}`) ?? "").trim();
    const imageFile    = formData.get(`imageFile_${i}`);
    const linkUrl      = String(formData.get(`linkUrl_${i}`) ?? "").trim();

    const resolved = await resolveSlideImage({ imageFile, galleryUrl, currentImage });
    if (!resolved.ok) return { ok: false, error: `الشريحة ${i + 1}: ${resolved.error}` };

    if (resolved.imageUrl) {
      slides.push({ imageUrl: resolved.imageUrl, linkUrl });
    }
  }

  try {
    await prisma.siteSetting.upsert({
      where: { key: SITE_KEY_PROMO_BANNER_SLIDES },
      create: { key: SITE_KEY_PROMO_BANNER_SLIDES, value: JSON.stringify(slides) },
      update: { value: JSON.stringify(slides) },
    });
  } catch {
    return { ok: false, error: "تعذّر حفظ الإعدادات." };
  }

  revalidatePath("/");
  revalidatePath("/admin/promo-banner");
  return { ok: true };
}
