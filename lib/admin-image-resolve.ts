import "server-only";
import { ensureGalleryFolderSlug } from "@/lib/gallery-folder";
import { isSpacesConfigured, isTrustedSpacesImageUrl, uploadImageToSpaces } from "@/lib/spaces-upload";

/**
 * يحسم رابط صورة إعداد إداري (رفع ملف / اختيار من المعرض / إبقاء الحالي) — مشترك
 * بين هيرو الصفحة الرئيسية وأيقونات وسائل الدفع لتجنّب تكرار نفس المنطق.
 * `folderSlug` يُنشأ تلقائياً إن لم يوجد (`ensureGalleryFolderSlug`) — مجلدات
 * داخلية لا تتطلب من الأدمن إنشاءها يدوياً من معرض الصور أولاً.
 */
export async function resolveUploadedImageUrl(opts: {
  imageFile: FormDataEntryValue | null;
  galleryImageUrl: string;
  currentImage: string;
  fallbackDefault: string;
  isAllowedUrl: (url: string) => boolean;
  folderSlug: string;
  folderLabel: string;
}): Promise<{ ok: true; imageUrl: string } | { ok: false; error: string }> {
  const { imageFile, galleryImageUrl, currentImage, fallbackDefault, isAllowedUrl, folderSlug, folderLabel } = opts;

  let imageUrl = currentImage.trim();

  if (imageFile instanceof File && imageFile.size > 0) {
    if (!isSpacesConfigured()) {
      return {
        ok: false,
        error: "لم يُضبط تخزين Spaces في البيئة (SPACES_REGION، المفاتيح، SPACES_BUCKET).",
      };
    }
    try {
      await ensureGalleryFolderSlug(folderSlug, folderLabel);
      imageUrl = await uploadImageToSpaces(imageFile, folderSlug);
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

  if (!isAllowedUrl(imageUrl)) {
    return {
      ok: false,
      error: "رابط الصورة غير مسموح. اختر صورة من المعرض أو ارفع ملفاً إلى Spaces، أو استخدم الصورة الافتراضية.",
    };
  }

  return { ok: true, imageUrl };
}
