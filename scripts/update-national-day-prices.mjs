/**
 * تحديث الحد الأدنى للسعر (يومي/شهري) على مستوى **الموديل** لأسعار اليوم
 * الوطني — قائمة يدوية مضمَّنة في هذا الملف (مش من xlsx):
 *   node scripts/update-national-day-prices.mjs [--apply]
 *
 * السلوك: **تحديث جزئي** — يعدّل فقط الموديلات المذكورة في DATA بالأسفل،
 * ولا يمسّ أي موديل غير مذكور (بعكس `import-model-min-prices.mjs` اللي
 * بيعمل استبدال كامل).
 *
 * المطابقة: بالاسم (بعد تطبيع الهمزات/الألف المقصورة) + السنة فقط، بلا ماركة
 * — أسماء الموديلات في القائمة فريدة بالفعل داخل القاعدة.
 *
 * dry-run افتراضياً — لا يكتب شيئاً بدون `--apply`.
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// م، النوع، الموديل(سنة)، الأدنى اليومي، اليومي الوطني، الأدنى الشهري، الشهري الوطني
const DATA = [
  ["ستاريا", 2024, 391.30, 344.35, 5652.17, 5040.00],
  ["ونيت بيك اب", 2025, 300.00, 257.39, 5000.00, 4431.30],
  ["ونيت بيك اب", 2024, 275.00, 257.39, 4750.00, 4692.17],
  ["سوناتا", 2025, 260.00, 257.39, 5500.00, 4866.09],
  ["ونيت بيك اب", 2023, 250.00, 250.00, 4500.00, 3996.52],
  ["سوناتا", 2024, 220.00, 220.00, 4347.82, 3909.57],
  ["كارينز", 2024, 217.39, 217.39, 3800.00, 3387.83],
  ["K4", 2026, 200.00, 170.43, 4295.00, 3822.61],
  ["سوناتا", 2023, 200.00, 170.43, 3913.00, 3474.78],
  ["كامري", 2023, 200.00, 170.43, 3913.00, 3474.78],
  ["فيلوز", 2023, 180.00, 170.43, 3000.00, 2692.17],
  ["النترا", 2024, 160.00, 160.00, 3200.00, 2866.09],
  ["النترا", 2023, 150.00, 150.00, 3000.00, 2692.17],
  ["كورولا", 2023, 150.00, 150.00, 2609.00, 2344.35],
  ["فينو", 2025, 140.00, 140.00, 3000.00, 2605.22],
  ["اكسنت", 2025, 130.00, 130.00, 2550.00, 2257.39],
  ["فينو", 2024, 130.00, 130.00, 2869.56, 2518.26],
  ["اكسنت", 2024, 120.00, 120.00, 2400.00, 2083.48],
  ["اكسنت", 2023, 115.00, 115.00, 2260.00, 1996.52],
  ["بيجاس", 2025, 115.00, 115.00, 2130.00, 1909.57],
  ["رايز", 2023, 115.00, 115.00, 2608.69, 2344.35],
  ["يارس", 2024, 113.00, 113.00, 2347.82, 2083.48],
  ["بيجاس", 2024, 110.00, 83.48, 2000.00, 1735.65],
  ["جراند اي 10", 2024, 108.00, 83.48, 1800.00, 1735.65],
  ["جراند اي 10", 2025, 108.00, 83.48, 1800.00, 1735.65],
  ["ديزاير", 2024, 108.00, 83.48, 1800.00, 1735.65],
  ["بيجاس", 2023, 105.00, 83.48, 1800.00, 1735.65],
  ["بيجاس", 2022, 100.00, 83.48, 1800.00, 1735.65],
  ["يارس", 2023, 100.00, 83.48, 2260.00, 1996.52],
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

const round2 = (n) => Math.round(n * 100) / 100;
const fmt = (n) => (n == null ? "—" : String(round2(n)));

async function main() {
  const apply = process.argv.includes("--apply");

  const models = await prisma.carModel.findMany({
    select: {
      id: true,
      name: true,
      year: true,
      minPricePerDayExclTax: true,
      minPriceMonthlyExclTax: true,
      brand: { select: { name: true } },
    },
  });

  // فهرسة بالاسم المطبَّع + السنة — مع رصد أي تصادم (أكثر من موديل بنفس الاسم/السنة).
  const byKey = new Map();
  for (const m of models) {
    const k = `${norm(m.name)}|${m.year}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(m);
  }

  const matched = [];
  const unmatched = [];
  const ambiguous = [];

  for (const [name, year, minDay, natDay, minMonth, natMonth] of DATA) {
    const k = `${norm(name)}|${year}`;
    const candidates = byKey.get(k) ?? [];
    if (candidates.length === 0) {
      unmatched.push({ name, year });
    } else if (candidates.length > 1) {
      ambiguous.push({ name, year, candidates });
    } else {
      matched.push({ name, year, minDay, natDay, minMonth, natMonth, m: candidates[0] });
    }
  }

  console.log(`القائمة: ${DATA.length} صف | متطابق: ${matched.length} | غير متطابق: ${unmatched.length} | مُلتبس: ${ambiguous.length}`);

  if (unmatched.length) {
    console.log("\n=== صفوف بلا موديل مطابق في القاعدة (لن تُطبَّق) ===");
    for (const r of unmatched) console.log(`  ${r.name} ${r.year}`);
  }

  if (ambiguous.length) {
    console.log("\n=== صفوف مُلتبسة — أكثر من موديل بنفس الاسم/السنة (لن تُطبَّق) ===");
    for (const r of ambiguous) {
      console.log(`  ${r.name} ${r.year}: ${r.candidates.map((c) => `#${c.id} (${c.brand.name})`).join(", ")}`);
    }
  }

  // ملاحظة: الأدنى الحالي بالقاعدة بيطابق عمود "السعر الأدنى" بالجدول غالباً (هو
  // السعر المعروض حالياً)، والتحديث الفعلي هو النزول لأسعار "اليوم الوطني".
  console.log("\n=== التحديثات (الحد الأدنى الحالي -> سعر اليوم الوطني) ===");
  for (const r of matched) {
    const { m } = r;
    const changed = m.minPricePerDayExclTax !== r.natDay || m.minPriceMonthlyExclTax !== r.natMonth;
    const baselineMismatch =
      m.minPricePerDayExclTax != null && round2(m.minPricePerDayExclTax) !== round2(r.minDay);
    console.log(
      `  ${changed ? "~" : "="} #${m.id} ${m.brand.name} ${m.name} ${m.year}: ` +
        `يومي ${fmt(m.minPricePerDayExclTax)} -> ${fmt(r.natDay)} | شهري ${fmt(m.minPriceMonthlyExclTax)} -> ${fmt(r.natMonth)}` +
        (baselineMismatch ? `  [!] الأدنى الحالي (${fmt(m.minPricePerDayExclTax)}) لا يطابق عمود "السعر الأدنى" بالجدول (${fmt(r.minDay)})` : ""),
    );
  }

  if (!apply) {
    console.log("\n[DRY RUN] لم يُكتب أي شيء. أضف --apply للتنفيذ.");
    await prisma.$disconnect();
    return;
  }

  await prisma.$transaction(
    async (tx) => {
      for (const r of matched) {
        await tx.carModel.update({
          where: { id: r.m.id },
          data: {
            minPricePerDayExclTax: round2(r.natDay),
            minPriceMonthlyExclTax: round2(r.natMonth),
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
