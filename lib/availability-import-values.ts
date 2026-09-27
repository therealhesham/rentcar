/**
 * مراجعة قيم ملف «تحديث الاتاحة» قبل الفحص — مشترك بين الواجهة والسيرفر (بلا أي import سيرفري).
 *
 * ملفات الفروع بتيجي بأخطاء إملائية بسيطة (حرف ناقص، همزة، تاء مربوطة...) فتفشل المطابقة
 * الحرفية في `buildBranchResolver` / `resolveModelId`. هنا: مفتاح ثابت لكل قيمة مميزة في الملف
 * (يربط اختيار المستخدم بالصفوف) + تقييم تشابه تقريبي لاقتراح أقرب فرع/موديل.
 */

/** مفتاح قيمة الفرع كما هي في الملف — نفس القص الذي تطبّقه `cell()` على السيرفر. */
export function branchValueKey(raw: string): string {
  return raw.trim();
}

/** مفتاح تركيبة الماركة+الموديل+السنة كما هي في الملف. */
export function modelValueKey(brand: string, model: string, year: string): string {
  return [brand.trim(), model.trim(), year.trim()].join("|");
}

/** اختيارات المستخدم: مفتاح القيمة في الملف → id الفرع/الموديل الصحيح. */
export type AvailabilityValueOverrides = {
  branch: Record<string, number>;
  model: Record<string, number>;
};

/** تطبيع متسامح للمقارنة التقريبية: يوحّد الهمزات والتاء المربوطة والياء ويزيل التشكيل والمسافات. */
export function looseNormalize(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[ً-ٰٟـ]/g, "") // تشكيل + تطويل
    .replace(/^فرع\s+/, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/^ال/, "")
    .replace(/[\s_\-–—/|.,()[\]]+/g, "");
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(
        prev[j]! + 1,
        cur[j - 1]! + 1,
        prev[j - 1]! + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    prev = cur;
  }
  return prev[b.length]!;
}

/** تشابه بين 0 و1 بعد التطبيع المتسامح (1 = متطابقان). */
export function similarity(a: string, b: string): number {
  const x = looseNormalize(a);
  const y = looseNormalize(b);
  if (!x || !y) return 0;
  if (x === y) return 1;
  const base = 1 - levenshtein(x, y) / Math.max(x.length, y.length);
  // «الرياض» داخل «الرياض - العليا» مثلاً: احتواء كامل يرفع الدرجة
  const contains = x.includes(y) || y.includes(x) ? 0.85 : 0;
  return Math.max(base, contains);
}

/** أقل درجة تشابه ليُختار الاقتراح تلقائياً في القائمة (مع تمييزه للمراجعة). */
export const AUTO_SUGGEST_MIN_SCORE = 0.6;
