"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdminForAction } from "@/lib/admin-access";
import { resolveUploadedImageUrl } from "@/lib/admin-image-resolve";
import {
  DEFAULT_HOME_HERO_IMAGE_ALT,
  DEFAULT_HOME_HERO_IMAGE_URL,
  isAllowedHomeHeroImageUrl,
  MAX_HOME_HERO_SLIDES,
  SITE_KEY_HOME_HERO_IMAGE_ALT,
  SITE_KEY_HOME_HERO_IMAGE_URL,
  SITE_KEY_HOME_HERO_SLIDES,
  type HomeHeroSlide,
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

  const slides: HomeHeroSlide[] = [];

  for (let i = 0; i < MAX_HOME_HERO_SLIDES; i++) {
    if (String(formData.get(`remove_${i}`) ?? "") === "on") continue;

    const currentImage = String(formData.get(`currentImage_${i}`) ?? "").trim();
    const galleryImageUrl = String(formData.get(`galleryImageUrl_${i}`) ?? "").trim();
    const imageFile = formData.get(`imageFile_${i}`);
    const hasUpload = imageFile instanceof File && imageFile.size > 0;

    // شريحة فارغة تماماً تُتجاهل بدل أن تسقط على الصورة الافتراضية
    if (!hasUpload && !galleryImageUrl && !currentImage) continue;

    const resolved = await resolveUploadedImageUrl({
      imageFile,
      galleryImageUrl,
      currentImage,
      fallbackDefault: DEFAULT_HOME_HERO_IMAGE_URL,
      isAllowedUrl: isAllowedHomeHeroImageUrl,
      folderSlug: "home",
      folderLabel: "الصفحة الرئيسية (هيرو)",
    });
    if (!resolved.ok) {
      return { ok: false, error: `الشريحة ${i + 1}: ${resolved.error}` };
    }

    const imageAlt =
      String(formData.get(`imageAlt_${i}`) ?? "").trim() || DEFAULT_HOME_HERO_IMAGE_ALT;

    slides.push({ imageUrl: resolved.imageUrl, imageAlt });
  }

  if (slides.length === 0) {
    return { ok: false, error: "أضف صورة واحدة على الأقل لخلفية الهيرو." };
  }

  try {
    await upsertSiteSetting(SITE_KEY_HOME_HERO_SLIDES, JSON.stringify(slides));
    // المفتاحان المفردان يبقيان محدَّثين بالشريحة الأولى للتوافق مع الإعداد القديم
    await upsertSiteSetting(SITE_KEY_HOME_HERO_IMAGE_URL, slides[0].imageUrl);
    await upsertSiteSetting(SITE_KEY_HOME_HERO_IMAGE_ALT, slides[0].imageAlt);
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
