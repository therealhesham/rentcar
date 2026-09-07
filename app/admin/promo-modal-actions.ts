"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdminForAction } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { resolvePromoSlideImage } from "@/lib/promo-slide-image";
import {
  isAllowedPromoModalImageUrl,
  normalizePromoModalCooldownMinutes,
  PROMO_MODAL_GALLERY_FOLDER,
  SITE_KEY_PROMO_MODAL,
  type PromoModalSettings,
  type PromoModalSlide,
} from "@/lib/site-settings";

const MAX_SLIDES = 5;

export async function updatePromoModal(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const slides: PromoModalSlide[] = [];

  for (let i = 0; i < MAX_SLIDES; i++) {
    const currentImage = String(formData.get(`currentImage_${i}`) ?? "").trim();
    const galleryUrl   = String(formData.get(`galleryImageUrl_${i}`) ?? "").trim();
    const imageFile    = formData.get(`imageFile_${i}`);
    const linkUrl      = String(formData.get(`linkUrl_${i}`) ?? "").trim();

    const resolved = await resolvePromoSlideImage({
      imageFile,
      galleryUrl,
      currentImage,
      folderSlug: PROMO_MODAL_GALLERY_FOLDER,
      folderLabel: "النافذة الترويجية",
      isAllowedImageUrl: isAllowedPromoModalImageUrl,
    });
    if (!resolved.ok) return { ok: false, error: `الصورة ${i + 1}: ${resolved.error}` };

    if (resolved.imageUrl) {
      slides.push({ imageUrl: resolved.imageUrl, linkUrl });
    }
  }

  const settings: PromoModalSettings = {
    enabled: formData.get("enabled") === "on" && slides.length > 0,
    cooldownMinutes: normalizePromoModalCooldownMinutes(formData.get("cooldownMinutes")),
    slides,
  };

  try {
    await prisma.siteSetting.upsert({
      where: { key: SITE_KEY_PROMO_MODAL },
      create: { key: SITE_KEY_PROMO_MODAL, value: JSON.stringify(settings) },
      update: { value: JSON.stringify(settings) },
    });
  } catch {
    return { ok: false, error: "تعذّر حفظ الإعدادات." };
  }

  revalidatePath("/");
  revalidatePath("/admin/promo-modal");
  return { ok: true };
}
