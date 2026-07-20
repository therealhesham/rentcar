/**
 * استيراد أسعار الفروع من ملف CSV (اسعار الاولين):
 *   node scripts/import-branch-prices.mjs "<csv-path>" [--apply]
 *
 * الأعمدة: م,المدينة,المدينة,الفرع,الفئة,الطراز(الماركة),النوع(الموديل),الموديل(السنة),سعر اليوم,سعر الشهر
 * - يطابق (الماركة + الموديل + السنة) مع CarModel الموجود فقط — الناقص يُدرج في التقرير ولا يُنشأ.
 * - سعر الموديل الأساسي = السعر الأكثر تكراراً بين الصفوف (مقرّباً لأقرب ريال).
 * - سعر الفرع = الأكثر تكراراً داخل الفرع؛ يُخزَّن كتجاوز في Fleet.pricePerDayExclTax
 *   فقط إن اختلف عن السعر الأساسي (وإلا يُمسح التجاوز).
 * - صفوف الورش/التأمين (بدون فرع تأجير معروف) تُتجاهل.
 * - عمود سعر الشهر يُتجاهل (لا حقل شهري في قاعدة البيانات).
 */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const BRANCH_BY_CSV_NAME = new Map([
  ["العريض", 6],
  ["العنبرية", 7],
  ["العزيزية", 8],
  ["فلسطين الصحافة", 9],
  ["فرع الاجاويد", 10],
  ["الاجاويد", 10],
  ["طريق الملك عبدالعزيز", 11],
  ["تبوك", 12],
]);

function mode(nums) {
  const freq = new Map();
  for (const n of nums) freq.set(n, (freq.get(n) ?? 0) + 1);
  let best = nums[0];
  let bestCount = 0;
  for (const [n, c] of freq) {
    if (c > bestCount || (c === bestCount && n > best)) {
      best = n;
      bestCount = c;
    }
  }
  return best;
}

async function main() {
  const [csvPath, ...flags] = process.argv.slice(2);
  const apply = flags.includes("--apply");
  if (!csvPath) {
    console.error("Usage: node scripts/import-branch-prices.mjs <csv> [--apply]");
    process.exit(1);
  }

  const lines = fs
    .readFileSync(csvPath, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim());
  const rows = lines.slice(1).map((l) => l.split(","));

  // group[brand|model|year] = { branchPrices: Map<branchId, number[]>, allPrices: number[] }
  const groups = new Map();
  let skippedNoBranch = 0;
  let skippedBadPrice = 0;

  for (const r of rows) {
    if (r.length < 9) continue;
    const branchName = (r[3] ?? "").trim();
    const brand = (r[5] ?? "").trim();
    const model = (r[6] ?? "").trim();
    const year = Number((r[7] ?? "").trim());
    const dayPrice = Number((r[8] ?? "").trim());
    if (!brand || !model || !Number.isInteger(year)) continue;
    if (!Number.isFinite(dayPrice) || dayPrice <= 0) {
      skippedBadPrice++;
      continue;
    }
    const branchId = BRANCH_BY_CSV_NAME.get(branchName);
    if (!branchId) {
      skippedNoBranch++;
      continue;
    }
    const key = `${brand}|${model}|${year}`;
    if (!groups.has(key)) {
      groups.set(key, { brand, model, year, branchPrices: new Map(), allPrices: [] });
    }
    const g = groups.get(key);
    if (!g.branchPrices.has(branchId)) g.branchPrices.set(branchId, []);
    g.branchPrices.get(branchId).push(dayPrice);
    g.allPrices.push(dayPrice);
  }

  const branches = await prisma.branch.findMany({ select: { id: true, name: true } });
  const branchName = new Map(branches.map((b) => [b.id, b.name]));

  const missing = [];
  const planned = [];

  for (const g of groups.values()) {
    const brandRow = await prisma.brand.findFirst({ where: { name: g.brand } });
    const carModel = brandRow
      ? await prisma.carModel.findFirst({
          where: { brandId: brandRow.id, name: g.model, year: g.year },
        })
      : null;
    if (!carModel) {
      missing.push(g);
      continue;
    }

    const basePrice = Math.round(mode(g.allPrices));
    const overrides = [];
    for (const [branchId, prices] of g.branchPrices) {
      const branchPrice = mode(prices);
      // تجاوز فقط عند الاختلاف الفعلي عن السعر الأساسي (86.96 ≠ 87 = تجاوز يحفظ الدقة)
      overrides.push({
        branchId,
        price: branchPrice === basePrice ? null : branchPrice,
      });
    }
    planned.push({ g, carModel, basePrice, overrides });
  }

  console.log(`صفوف الملف: ${rows.length} — مجموعات موديل/سنة: ${groups.size}`);
  console.log(`تجاهل ${skippedNoBranch} صف (ورش/تأمين بدون فرع تأجير) و${skippedBadPrice} صف بسعر غير صالح.\n`);

  for (const p of planned) {
    const ovTxt = p.overrides
      .filter((o) => o.price != null)
      .map((o) => `${branchName.get(o.branchId)}=${o.price}`)
      .join("، ");
    console.log(
      `${p.g.brand} ${p.g.model} ${p.g.year} (#${p.carModel.id}): ` +
        `أساسي ${p.carModel.price} → ${p.basePrice}` +
        (ovTxt ? ` | تجاوزات: ${ovTxt}` : " | بدون تجاوزات"),
    );
  }

  if (missing.length) {
    console.log(`\n⚠️ غير موجود في قاعدة البيانات (${missing.length}) — لم يُحدَّث:`);
    for (const m of missing) console.log(`  - ${m.brand} ${m.model} ${m.year}`);
  }

  if (!apply) {
    console.log("\n(معاينة فقط — أعد التشغيل مع --apply للتطبيق)");
    return;
  }

  let updatedModels = 0;
  let setOverrides = 0;
  let clearedOverrides = 0;
  for (const p of planned) {
    await prisma.carModel.update({
      where: { id: p.carModel.id },
      data: { price: p.basePrice },
    });
    updatedModels++;
    for (const o of p.overrides) {
      const res = await prisma.fleet.updateMany({
        where: { modelId: p.carModel.id, branchId: o.branchId },
        data: { pricePerDayExclTax: o.price },
      });
      if (res.count > 0) {
        if (o.price != null) setOverrides++;
        else clearedOverrides++;
      }
    }
  }
  console.log(
    `\n✅ تم: تحديث ${updatedModels} موديل — ${setOverrides} سعر فرع خاص — ${clearedOverrides} فرع على السعر الأساسي.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
