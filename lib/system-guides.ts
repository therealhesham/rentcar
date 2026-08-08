/**
 * ثوابت شروحات النظام — مشتركة بين الخادم (تحقق الرفع) والعميل (تصفية اختيار الملف
 * ورسائل الحجم) عشان الحدّين ما يفترقوش.
 */

export type SystemGuideKindValue = "VIDEO" | "IMAGE" | "PDF";

/** مجلد Spaces الذي تُرفع تحته ملفات الشروحات (`rentcar/<slug>/`). */
export const SYSTEM_GUIDE_FOLDER_SLUG = "system-guides";

/** الفيديو أكبر بكثير من الصور — حدّ منفصل لكل نوع. */
export const SYSTEM_GUIDE_MAX_BYTES: Record<SystemGuideKindValue, number> = {
  VIDEO: 100 * 1024 * 1024,
  IMAGE: 10 * 1024 * 1024,
  PDF: 25 * 1024 * 1024,
};

/** أنواع MIME المسموحة → الامتداد المخزَّن به الملف على Spaces. */
const MIME_TO_EXT: Record<string, { kind: SystemGuideKindValue; ext: string }> = {
  "video/mp4": { kind: "VIDEO", ext: "mp4" },
  "video/webm": { kind: "VIDEO", ext: "webm" },
  "video/quicktime": { kind: "VIDEO", ext: "mov" },
  "image/jpeg": { kind: "IMAGE", ext: "jpg" },
  "image/png": { kind: "IMAGE", ext: "png" },
  "image/webp": { kind: "IMAGE", ext: "webp" },
  "image/gif": { kind: "IMAGE", ext: "gif" },
  "application/pdf": { kind: "PDF", ext: "pdf" },
};

/** قيمة `accept` لحقل الملف — نفس القائمة المسموحة على الخادم. */
export const SYSTEM_GUIDE_ACCEPT = Object.keys(MIME_TO_EXT).join(",");

export function systemGuideFileMeta(
  mimeType: string,
): { kind: SystemGuideKindValue; ext: string } | null {
  return MIME_TO_EXT[mimeType.toLowerCase().split(";")[0]?.trim() ?? ""] ?? null;
}

export function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} م.ب`;
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} ك.ب`;
  return `${bytes} بايت`;
}
