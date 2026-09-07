import { ensureGalleryFolderSlug } from "@/lib/gallery-folder";
import {
  isSpacesConfigured,
  isTrustedSpacesImageUrl,
  uploadImageToSpaces,
} from "@/lib/spaces-upload";

/**
 * يحسم صورة شريحة ترويجية من ثلاثة مصادر بالأولوية: ملف مرفوع الآن، ثم صورة
 * مختارة من المعرض، ثم الصورة المحفوظة سابقاً. يشترك فيه البانر الترويجي
 * والنافذة الترويجية لأن نموذجيهما متطابقان في أسماء الحقول.
 */
export async function resolvePromoSlideImage(opts: {
  imageFile: FormDataEntryValue | null;
  galleryUrl: string;
  currentImage: string;
  /** مجلد المعرض الذي تُرفَع إليه الصور الجديدة. */
  folderSlug: string;
  folderLabel: string;
  isAllowedImageUrl: (url: string) => boolean;
}): Promise<{ ok: true; imageUrl: string } | { ok: false; error: string }> {
  const {
    imageFile,
    galleryUrl,
    currentImage,
    folderSlug,
    folderLabel,
    isAllowedImageUrl,
  } = opts;
  let imageUrl = currentImage.trim();

  if (imageFile instanceof File && imageFile.size > 0) {
    if (!isSpacesConfigured()) {
      return { ok: false, error: "لم يُضبط تخزين Spaces في البيئة." };
    }
    try {
      await ensureGalleryFolderSlug(folderSlug, folderLabel);
      imageUrl = await uploadImageToSpaces(imageFile, folderSlug);
    } catch (e) {
      return { ok: false, error: e instanceof Error ? e.message : "فشل رفع الصورة." };
    }
  } else if (galleryUrl && isTrustedSpacesImageUrl(galleryUrl)) {
    imageUrl = galleryUrl;
  }

  if (imageUrl && !isAllowedImageUrl(imageUrl)) {
    return { ok: false, error: `رابط الصورة غير مسموح: ${imageUrl.slice(0, 60)}` };
  }

  return { ok: true, imageUrl };
}
