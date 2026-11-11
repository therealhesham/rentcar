/**
 * تحميل Google Maps JS API في المتصفح — مرة واحدة لكل الصفحة.
 * موديول التوصيل (خريطة العميل وخريطة الأدمن) يعتمد على جوجل وحده.
 */

export const GOOGLE_MAPS_BROWSER_KEY =
  process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY?.trim() ?? "";

let optionsSet = false;

/** يضبط إعدادات المحمِّل مرة واحدة ويعيد `importLibrary`. */
export async function getGoogleMapsImporter() {
  const { setOptions, importLibrary } = await import("@googlemaps/js-api-loader");
  if (!optionsSet) {
    setOptions({ key: GOOGLE_MAPS_BROWSER_KEY, v: "weekly", language: "ar", region: "SA" });
    optionsSet = true;
  }
  return importLibrary;
}

export const GOOGLE_MAPS_UNAVAILABLE_MESSAGE =
  "تعذّر تحميل خرائط جوجل. تأكد من ضبط مفتاح الخرائط وتفعيل الفوترة، ثم أعد المحاولة.";
