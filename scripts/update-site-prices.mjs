/**
 * تحديث أسعار السيارات على مستوى **الموديل** من قائمة يدوية مضمَّنة بالأسفل:
 *   node scripts/update-site-prices.mjs            # معاينة فقط (dry-run) — لا يكتب شيئاً
 *   node scripts/update-site-prices.mjs --apply    # ينفّذ التحديث فعلياً
 *
 * لكل موديل يُحدَّث 4 حقول:
 *   price                  = السعر الأعلى (يومى)
 *   minPricePerDayExclTax  = السعر الأدنى (يومى)
 *   priceMonthlyExclTax    = السعر الأعلى (شهرى)
 *   minPriceMonthlyExclTax = السعر الأدنى (شهرى)
 *
 * السلوك: **تحديث جزئي** — يعدّل فقط الموديلات المذكورة في DATA ولا يمسّ غيرها.
 * المطابقة: بالاسم (بعد تطبيع الهمزات/الألف المقصورة) + السنة فقط، بلا ماركة —
 * أسماء الموديلات فريدة داخل القاعدة. الصفوف غير المطابقة أو الملتبسة تُطبَع
 * ولا تُطبَّق.
 *
 * dry-run افتراضياً — لا يكتب شيئاً بدون `--apply`.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// [الطراز(ماركة للعرض فقط), النوع(اسم الموديل), السنة, الأعلى يومي, الأدنى يومي, الأعلى شهري, الأدنى شهري]
const DATA = [
  ["ليكزس", "es250", 2022, 1300, 695.65, 39000, 20870],
  ["كيا", "K4", 2026, 230, 200, 5000, 4295],
  ["متسوبيشي", "اتراج", 2020, 120, 100, 1800, 1739],
  ["متسوبيشي", "اتراج", 2021, 120, 100, 1800, 1655],
  ["هيونداي", "اكسنت", 2020, 120, 100, 2100, 1800],
  ["هيونداي", "اكسنت", 2023, 135, 115, 2550, 2260],
  ["هيونداي", "اكسنت", 2024, 140, 120, 2600, 2400],
  ["هيونداي", "اكسنت", 2025, 150, 130, 2750, 2550],
  ["هيونداي", "النترا", 2020, 130, 110, 3000, 2100],
  ["هيونداي", "النترا", 2023, 170, 150, 3200, 3000],
  ["هيونداي", "النترا", 2024, 180, 160, 3450, 3200],
  ["متسوبيشي", "أتراج", 2022, 120, 100, 1800, 1740],
  ["كيا", "بيجاس", 2022, 120, 100, 2000, 1800],
  ["كيا", "بيجاس", 2023, 130, 105, 2000, 1800],
  ["كيا", "بيجاس", 2024, 140, 110, 2200, 2000],
  ["كيا", "بيجاس", 2025, 145, 115, 2300, 2130],
  ["شيري", "تيجو 4 برو", 2023, 400, 400, 5000, 5000],
  ["هيونداي", "جراند اي 10", 2024, 115, 108, 2000, 1800],
  ["هيونداي", "جراند اي 10", 2025, 115, 108, 2000, 1800],
  ["سوزوكي", "ديزاير", 2024, 115, 108, 2000, 1800],
  ["تويوتا", "رايز", 2023, 150, 115, 3000, 2608.69],
  ["هيونداي", "ستاريا", 2024, 500, 391.3, 6956.5, 5652.17],
  ["هيونداي", "ستاريا", 2025, 500, 391.3, 6956.5, 5652.17],
  ["هيونداي", "سوناتا", 2023, 220, 200, 4347, 3913],
  ["هيونداي", "سوناتا", 2024, 250, 220, 5000, 4347.82],
  ["هيونداي", "سوناتا", 2025, 300, 260, 6000, 5500],
  ["نيسان", "صني", 2020, 120, 100, 2100, 1740],
  ["تويوتا", "فيلوز", 2023, 217.39, 180, 4347, 3000],
  ["هيونداي", "فينو", 2024, 160, 130, 3260, 2869.56],
  ["هيونداي", "فينو", 2025, 175, 140, 3500, 3000],
  ["كيا", "كارينز", 2024, 300, 217.39, 5500, 3800],
  ["تويوتا", "كامرى", 2023, 300, 200, 6500, 3913],
  ["تويوتا", "كامري", 2020, 250, 220, 5400, 5000],
  ["تويوتا", "كورولا", 2023, 170, 150, 3100, 2609],
  ["تويوتا", "كورولا", 2021, 150, 100, 3000, 2260],
  ["وينجل 7", "ونيت بيك اب", 2025, 350, 300, 6000, 5000],
  ["وينجل 7", "ونيت بيك اب", 2024, 350, 275, 5750, 4750],
  ["وينجل 7", "ونيت بيك اب", 2023, 350, 250, 5500, 4500],
  ["تويوتا", "يارس", 2020, 120, 100, 2200, 1800],
  ["تويوتا", "يارس", 2021, 120, 100, 2100, 1800],
  ["تويوتا", "يارس", 2023, 130, 100, 3000, 2260],
  ["تويوتا", "يارس", 2024, 140, 113, 2434.78, 2347.82],
];

/** توحيد الهمزات والياء/الألف المقصورة — بعض الأسماء بالقاعدة "كامرى" مش "كامري". */
function norm(s) {
  return String(s ?? "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/[ـً-ْ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * أسماء بديلة معروفة لنفس الموديل — تُطبَّق على اسم القاعدة واسم القائمة معاً
 * قبل المطابقة، عشان تتم المطابقة بالاسم (مش بالـ ID) على أي قاعدة بما فيها
 * البروداكشن حتى لو الاسم متسجّل بصيغة مختلفة. المفتاح والقيمة بعد التطبيع.
 * مثال: البيك اب 2025 متسجّل "Wingle Pickup" بدل "ونيت بيك اب".
 */
const NAME_ALIASES = {
  "wingle pickup": "ونيت بيك اب",
};

/** الاسم القياسي للمطابقة: تطبيع + تصغير حروف لاتينية + جدول الأسماء البديلة. */
function canonName(s) {
  const n = norm(s).toLowerCase();
  return NAME_ALIASES[n] ?? n;
}

const round2 = (n) => Math.round(n * 100) / 100;
const fmt = (n) => (n == null ? "—" : String(round2(n)));

async function main() {
  const apply = process.argv.includes("--apply");

  const models = await prisma.carModel.findMany({
    select: {
      id: true,
      name: true,
      year: true,
      price: true,
      priceMonthlyExclTax: true,
      minPricePerDayExclTax: true,
      minPriceMonthlyExclTax: true,
      brand: { select: { name: true } },
    },
  });

  // فهرسة بالاسم القياسي (تطبيع + أسماء بديلة) + السنة — مع رصد أي تصادم.
  const byKey = new Map();
  for (const m of models) {
    const k = `${canonName(m.name)}|${m.year}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(m);
  }

  const matched = [];
  const unmatched = [];
  const ambiguous = [];

  for (const row of DATA) {
    const [brand, name, year] = row;
    const k = `${canonName(name)}|${year}`;
    const c = byKey.get(k) ?? [];
    if (c.length === 0) unmatched.push({ brand, name, year });
    else if (c.length > 1) ambiguous.push({ brand, name, year, c });
    else matched.push({ row, m: c[0] });
  }

  console.log(
    `القائمة: ${DATA.length} صف | متطابق: ${matched.length} | غير موجود: ${unmatched.length} | ملتبس: ${ambiguous.length} | إجمالي موديلات القاعدة: ${models.length}`,
  );

  if (unmatched.length) {
    console.log("\n=== [!] صفوف في القائمة بلا موديل مطابق بالقاعدة (لن تُطبَّق) ===");
    for (const r of unmatched) console.log(`  ${r.brand} - ${r.name} - ${r.year}`);
  }

  if (ambiguous.length) {
    console.log("\n=== [!] صفوف ملتبسة — أكثر من موديل بنفس الاسم/السنة (لن تُطبَّق) ===");
    for (const r of ambiguous) {
      console.log(`  ${r.name} ${r.year}: ${r.c.map((c) => `#${c.id} (${c.brand.name})`).join(", ")}`);
    }
  }

  console.log("\n=== التغييرات (القيمة الحالية -> قيمة القائمة) — علامة ~ = هيتغير ===");
  for (const { row, m } of matched) {
    const [, , , dHigh, dLow, mHigh, mLow] = row;
    const changed =
      round2(m.price) !== round2(dHigh) ||
      round2(m.minPricePerDayExclTax ?? NaN) !== round2(dLow) ||
      round2(m.priceMonthlyExclTax ?? NaN) !== round2(mHigh) ||
      round2(m.minPriceMonthlyExclTax ?? NaN) !== round2(mLow);
    console.log(`  ${changed ? "~" : "="} #${m.id} ${m.brand.name} ${m.name} ${m.year}`);
    console.log(`       يومي:  ${fmt(m.price)} -> ${fmt(dHigh)}   | أدنى يومي:  ${fmt(m.minPricePerDayExclTax)} -> ${fmt(dLow)}`);
    console.log(`       شهري:  ${fmt(m.priceMonthlyExclTax)} -> ${fmt(mHigh)}   | أدنى شهري: ${fmt(m.minPriceMonthlyExclTax)} -> ${fmt(mLow)}`);
  }

  if (!apply) {
    console.log("\n[DRY RUN] لم يُكتب أي شيء. أضف --apply للتنفيذ.");
    await prisma.$disconnect();
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      for (const { row, m } of matched) {
        const [, , , dHigh, dLow, mHigh, mLow] = row;
        await tx.carModel.update({
          where: { id: m.id },
          data: {
            price: round2(dHigh),
            minPricePerDayExclTax: round2(dLow),
            priceMonthlyExclTax: round2(mHigh),
            minPriceMonthlyExclTax: round2(mLow),
          },
        });
      }
    },
    { timeout: 120_000, maxWait: 30_000 },
  );

  console.log(`\n[APPLIED] ${matched.length} موديل اتحدّث.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
