import path from "node:path";

/** حدود رفع وثائق الاشتراك */
export const SUBSCRIPTION_UPLOAD_MAX_BYTES = 5 * 1024 * 1024;
export const SUBSCRIPTION_ALLOWED_MIMES = new Set([
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
]);

/** دليل ملفات الاشتراك خارج `public/` (لا يُعرض بدون المصادقة). */
export function subscriptionUploadRootAbs(): string {
  return path.join(process.cwd(), "subscription-uploads");
}
