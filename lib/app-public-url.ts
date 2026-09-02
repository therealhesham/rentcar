/**
 * عنوان الموقع العام من `.env`، منظّف ومضمون الـscheme.
 * بدون `https://` صراحةً، بوابات الدفع (تابي/جيديا) بترفض روابط العودة أو
 * تفشل تحويل العميل ("Something went wrong" عند تابي) — رأيناها فعلياً في الإنتاج.
 */
export function getAppPublicUrl(): string {
  let url = (process.env.APP_PUBLIC_URL ?? "").trim().replace(/\/+$/, "");
  if (url && !/^https?:\/\//i.test(url)) {
    url = `https://${url}`;
  }
  return url;
}
