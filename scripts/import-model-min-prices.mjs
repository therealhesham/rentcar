/**
 * استيراد الحد الأدنى للسعر اليومي والشهري على مستوى **الموديل** من ملف أسعار
 * بلا أعمدة فروع:
 *   node scripts/import-model-min-prices.mjs "<xlsx-path>" [--apply]
 *
 * يختلف عن `import-min-prices.mjs` — ذاك يتوقع عمود «اسم الفرع» ويوزّع الحدود
 * على الفروع؛ وهذا لملف صفّه الواحد = موديل واحد (ماركة + نوع + سنة).
 *
 * السلوك (استبدال كامل، مش دمج):
 * 1. يمسح كل حدود `CarModel` و**تجاوزات** `Fleet` القائمة.
 * 2. يضبط حدود الموديلات الموجودة في الملف فقط.
 *    → أي موديل مش في الملف يبقى بلا حد أدنى.
 *
 * الأعمدة المستخدَمة (بالترتيب): 2=الطراز، 3=النوع، 4=الموديل(سنة)،
 * 6=السعر الأدنى اليومي، 8=السعر الأدنى الشهري. الباقي يُتجاهل.
 *
 * dry-run افتراضياً — لا يكتب شيئاً بدون `--apply`.
 */
import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * تصحيحات يدوية لصفوف خاطئة في الملف المصدر، مفتاحها «ماركة|نوع|سنة» بعد التطبيع.
 * فارغة حالياً — الأفضل تصحيح الملف المصدر نفسه بدل تراكم استثناءات هنا.
 */
const ROW_CORRECTIONS = new Map();

function cellText(v) {
  if (v == null) return "";
  if (typeof v === "object") {
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join("");
    if (v.result !== undefined) return String(v.result);
    if (v.text !== undefined) return String(v.text);
  }
  return String(v);
}

/** توحيد الهمزات والياء/الألف المقصورة — الملف والقاعدة يكتبان «كامري/كامرى». */
function norm(s) {
  return String(s ?? "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/[ـً-ْ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

const key = (brand, model, year) => `${norm(brand)}|${norm(model)}|${year}`;
const round2 = (n) => Math.round(n * 100) / 100;
const fmt = (n) => (n == null ? "—" : String(round2(n)));

async function main() {
  const [filePath, ...flags] = process.argv.slice(2);
  const apply = flags.includes("--apply");
  if (!filePath) {
    console.error("Usage: node scripts/import-model-min-prices.mjs <xlsx> [--apply]");
    process.exit(1);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.worksheets[0];

  const rows = [];
  ws.eachRow({ includeEmpty: false }, (row, i) => {
    if (i === 1) return; // العناوين
    const v = row.values;
    const brand = cellText(v[2]).trim();
    const model = cellText(v[3]).trim();
    const year = Number(cellText(v[4]));
    let minDay = Number(cellText(v[6]));
    const minMonth = Number(cellText(v[8]));
    if (!brand || !model || !Number.isInteger(year)) return;

    const fix = ROW_CORRECTIONS.get(key(brand, model, year));
    const correctedFrom = fix?.minDay != null && fix.minDay !== minDay ? minDay : null;
    if (fix?.minDay != null) minDay = fix.minDay;

    rows.push({ excelRow: i, brand, model, year, minDay, minMonth, correctedFrom, fix });
  });

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
  const byKey = new Map(models.map((m) => [key(m.brand.name, m.name, m.year), m]));

  const matched = [];
  const unmatched = [];
  for (const r of rows) {
    const m = byKey.get(key(r.brand, r.model, r.year));
    if (m) matched.push({ r, m });
    else unmatched.push(r);
  }
  const matchedIds = new Set(matched.map((x) => x.m.id));

  console.log(`الملف: ${rows.length} صف | متطابق: ${matched.length} | غير متطابق: ${unmatched.length}`);

  if (unmatched.length) {
    console.log("\n=== صفوف بلا موديل مطابق (لن تُطبَّق) ===");
    for (const r of unmatched) console.log(`  صف ${r.excelRow}: ${r.brand} | ${r.model} | ${r.year}`);
  }

  const corrected = rows.filter((r) => r.correctedFrom != null);
  if (corrected.length) {
    console.log("\n=== تصحيحات يدوية مطبَّقة ===");
    for (const r of corrected) {
      console.log(`  ${r.brand} ${r.model} ${r.year}: ${r.correctedFrom} -> ${r.minDay} (${r.fix.reason})`);
    }
  }

  const cleared = models.filter(
    (m) => !matchedIds.has(m.id) && (m.minPricePerDayExclTax != null || m.minPriceMonthlyExclTax != null),
  );
  console.log(`\n=== حدود ستُمسح (موديلات خارج الملف): ${cleared.length} ===`);
  for (const m of cleared) {
    console.log(`  ${m.brand.name} ${m.name} ${m.year}: يومي ${fmt(m.minPricePerDayExclTax)} / شهري ${fmt(m.minPriceMonthlyExclTax)}`);
  }

  console.log("\n=== الحدود الجديدة ===");
  for (const { r, m } of matched) {
    const changed = m.minPricePerDayExclTax !== r.minDay || m.minPriceMonthlyExclTax !== r.minMonth;
    console.log(
      `  ${changed ? "~" : "="} ${m.brand.name} ${m.name} ${m.year}: ` +
        `يومي ${fmt(m.minPricePerDayExclTax)} -> ${fmt(r.minDay)} | شهري ${fmt(m.minPriceMonthlyExclTax)} -> ${fmt(r.minMonth)}`,
    );
  }

  // تحذيرات سلامة — لا توقف التنفيذ، لكن تستحق المراجعة.
  const warns = [];
  for (const { r, m } of matched) {
    if (r.minDay > m.price) warns.push(`${m.brand.name} ${m.name} ${m.year}: أدنى يومي ${r.minDay} > الأساسي ${m.price}`);
    if (m.priceMonthlyExclTax != null && r.minMonth > m.priceMonthlyExclTax) {
      warns.push(`${m.brand.name} ${m.name} ${m.year}: أدنى شهري ${r.minMonth} > الشهري الأساسي ${m.priceMonthlyExclTax}`);
    }
    if (m.priceMonthlyExclTax == null && r.minMonth > 0) {
      warns.push(`${m.brand.name} ${m.name} ${m.year}: أدنى شهري ${r.minMonth} لكن الموديل بلا سعر شهري أساسي (الحد بلا أثر)`);
    }
  }
  console.log(`\n=== تحذيرات: ${warns.length} ===`);
  for (const w of warns) console.log(`  [!] ${w}`);

  const fleetOverrides = await prisma.fleet.count({
    where: { OR: [{ minPricePerDayExclTax: { not: null } }, { minPriceMonthlyExclTax: { not: null } }] },
  });
  console.log(`\n=== تجاوزات الفروع التي ستُمسح: ${fleetOverrides} ===`);

  if (!apply) {
    console.log("\n[DRY RUN] لم يُكتب أي شيء. أضف --apply للتنفيذ.");
    await prisma.$disconnect();
    return;
  }

  // استبدال كامل داخل معاملة واحدة — لا نترك القاعدة في حالة نصف محدَّثة.
  // المهلة الافتراضية (5 ث) لا تكفي لعشرات التحديثات على قاعدة بعيدة.
  await prisma.$transaction(
    async (tx) => {
      await tx.carModel.updateMany({
        data: { minPricePerDayExclTax: null, minPriceMonthlyExclTax: null },
      });
      await tx.fleet.updateMany({
        data: { minPricePerDayExclTax: null, minPriceMonthlyExclTax: null },
      });
      for (const { r, m } of matched) {
        await tx.carModel.update({
          where: { id: m.id },
          data: {
            minPricePerDayExclTax: r.minDay > 0 ? round2(r.minDay) : null,
            minPriceMonthlyExclTax: r.minMonth > 0 ? round2(r.minMonth) : null,
          },
        });
      }
    },
    { timeout: 120_000, maxWait: 30_000 },
  );

  console.log(`\n[APPLIED] ${matched.length} موديل مضبوط، والباقي بلا حد، وتجاوزات الفروع ممسوحة.`);
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
