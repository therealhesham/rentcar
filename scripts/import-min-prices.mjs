/**
 * استيراد الحد الأدنى للسعر اليومي والشهري من ملف الأسطول (Excel):
 *   node scripts/import-min-prices.mjs "<xlsx-path>" [--apply]
 *
 * أعمدة الملف المستخدَمة: اسم الفرع، الطراز(الماركة)، النوع(الموديل)، الموديل(السنة)،
 * «السعر الأدنى اليومي»، «السعر الأدنى الشهري». باقي الأعمدة تُتجاهل.
 *
 * المنطق نفسه المستخدَم في `import-branch-prices.mjs` (انظره للتفاصيل):
 * - المطابقة مع CarModel الموجود فقط (ماركة + موديل + سنة) — الناقص يُدرج في التقرير ولا يُنشأ.
 * - حد الموديل الأساسي = القيمة الأكثر تكراراً بين مركبات الفروع المعروفة.
 * - حد الفرع يُخزَّن كتجاوز في `Fleet.minPrice*` فقط عند اختلافه عن الأساسي (وإلا يُمسح).
 * - صفوف الورش/التأمين/الفروع غير المعروفة في القاعدة تُتجاهل تماماً (لا تؤثر حتى على الأساسي).
 * - الفروع غير الموجودة في الملف لا تُلمس تجاوزاتها.
 */
import ExcelJS from "exceljs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** خلايا الملف مكتوبة بخطوط مختلفة داخل الخلية الواحدة فتصل كـ richText بدل نص. */
function cellText(v) {
  if (v == null) return "";
  if (typeof v === "object") {
    if (Array.isArray(v.richText)) return v.richText.map((t) => t.text).join("");
    if (v.result !== undefined) return String(v.result);
    if (v.text !== undefined) return String(v.text);
  }
  return String(v);
}

/** توحيد الهمزات والياء/الألف المقصورة — الملف والقاعدة يكتبان «أتراج/اتراج» و«كامري/كامرى». */
function norm(s) {
  return s
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/[ـً-ْ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** اسم الفرع في الملف يسبقه اسم المدينة: «المدينة - العريض»، «جدة -فرع الاجاويد». */
function branchCandidates(raw) {
  const cleaned = norm(raw).replace(/\s*[-–—]\s*/g, "|");
  const parts = cleaned.split("|").map((p) => p.replace(/^فرع\s+/, "").trim()).filter(Boolean);
  return [...new Set([...parts, cleaned.replace(/\|/g, " ")])];
}

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

const fmt = (n) => (n == null ? "—" : String(Math.round(n * 100) / 100));

async function main() {
  const [filePath, ...flags] = process.argv.slice(2);
  const apply = flags.includes("--apply");
  // استبعاد مجموعات بعينها (صفوف خاطئة في الملف): --skip="ماركة|موديل|سنة;ماركة|موديل|سنة"
  const skipKeys = new Set(
    flags
      .filter((f) => f.startsWith("--skip="))
      .flatMap((f) => f.slice("--skip=".length).split(";"))
      .map((s) => norm(s))
      .filter(Boolean),
  );
  if (!filePath) {
    console.error(
      'Usage: node scripts/import-min-prices.mjs <xlsx> [--apply] [--skip="ماركة|موديل|سنة"]',
    );
    process.exit(1);
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(filePath);
  const ws = wb.worksheets[0];

  const branches = await prisma.branch.findMany({ select: { id: true, name: true } });
  const branchByName = new Map(branches.map((b) => [norm(b.name), b.id]));
  const branchName = new Map(branches.map((b) => [b.id, b.name]));

  function resolveBranchId(raw) {
    for (const cand of branchCandidates(raw)) {
      if (branchByName.has(cand)) return branchByName.get(cand);
    }
    return null;
  }

  // groups[brand|model|year] = { day: {all:[], byBranch:Map}, month: {...} }
  const groups = new Map();
  const unknownBranches = new Map();
  let skippedBadValue = 0;
  let totalRows = 0;

  ws.eachRow({ includeEmpty: false }, (row, i) => {
    if (i === 1) return; // العناوين
    const v = row.values;
    const rawBranch = cellText(v[3]).trim();
    const brand = cellText(v[6]).trim();
    const model = cellText(v[7]).trim();
    const year = Number(cellText(v[8]).trim());
    const minDay = Number(cellText(v[11]));
    const minMonth = Number(cellText(v[13]));
    if (!brand || !model || !Number.isInteger(year)) return;
    totalRows++;

    const branchId = resolveBranchId(rawBranch);
    if (branchId == null) {
      unknownBranches.set(rawBranch, (unknownBranches.get(rawBranch) ?? 0) + 1);
      return;
    }
    if (!(minDay > 0) && !(minMonth > 0)) {
      skippedBadValue++;
      return;
    }

    const key = `${norm(brand)}|${norm(model)}|${year}`;
    if (!groups.has(key)) {
      groups.set(key, {
        brand,
        model,
        year,
        day: { all: [], byBranch: new Map() },
        month: { all: [], byBranch: new Map() },
      });
    }
    const g = groups.get(key);
    for (const [field, value] of [["day", minDay], ["month", minMonth]]) {
      if (!(value > 0)) continue;
      g[field].all.push(value);
      if (!g[field].byBranch.has(branchId)) g[field].byBranch.set(branchId, []);
      g[field].byBranch.get(branchId).push(value);
    }
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
  const modelByKey = new Map(
    models.map((m) => [`${norm(m.brand.name)}|${norm(m.name)}|${m.year}`, m]),
  );

  const planned = [];
  const missing = [];
  const warnings = [];
  const skipped = [];

  for (const g of groups.values()) {
    const groupKey = `${norm(g.brand)}|${norm(g.model)}|${g.year}`;
    if (skipKeys.has(groupKey)) {
      skipped.push(g);
      continue;
    }
    const carModel = modelByKey.get(groupKey);
    if (!carModel) {
      missing.push(g);
      continue;
    }

    const baseDay = g.day.all.length ? mode(g.day.all) : null;
    const baseMonth = g.month.all.length ? mode(g.month.all) : null;

    // الأرضية فوق السعر المعلن = سوء إعداد؛ منطق التسعير يتجاهلها ويرفع تنبيهاً للإدارة.
    if (baseDay != null && baseDay > carModel.price) {
      warnings.push(`${g.brand} ${g.model} ${g.year}: حد يومي ${fmt(baseDay)} > سعر اليوم ${carModel.price}`);
    }
    if (baseMonth != null && carModel.priceMonthlyExclTax != null && baseMonth > carModel.priceMonthlyExclTax) {
      warnings.push(
        `${g.brand} ${g.model} ${g.year}: حد شهري ${fmt(baseMonth)} > السعر الشهري ${carModel.priceMonthlyExclTax}`,
      );
    }
    // حد أدنى تحت نصف السعر المعلن غالباً خطأ إدخال في ملف الأسطول لا سياسة تسعير.
    if (baseDay != null && baseDay < carModel.price * 0.5) {
      warnings.push(
        `${g.brand} ${g.model} ${g.year}: حد يومي ${fmt(baseDay)} أقل من نصف سعر اليوم (${carModel.price}) — تأكّد من الملف`,
      );
    }

    const branchIds = new Set([...g.day.byBranch.keys(), ...g.month.byBranch.keys()]);
    const overrides = [];
    for (const branchId of branchIds) {
      const dayVals = g.day.byBranch.get(branchId) ?? [];
      const monthVals = g.month.byBranch.get(branchId) ?? [];
      const day = dayVals.length ? mode(dayVals) : null;
      const month = monthVals.length ? mode(monthVals) : null;
      overrides.push({
        branchId,
        minPricePerDayExclTax: day == null || day === baseDay ? null : day,
        minPriceMonthlyExclTax: month == null || month === baseMonth ? null : month,
      });
    }

    planned.push({ g, carModel, baseDay, baseMonth, overrides });
  }

  planned.sort((a, b) => a.carModel.id - b.carModel.id);

  console.log(`صفوف الملف: ${totalRows} — مجموعات ماركة/موديل/سنة: ${groups.size}`);
  if (skippedBadValue) console.log(`تخطّي ${skippedBadValue} صف بلا حد أدنى صالح.`);
  if (unknownBranches.size) {
    const txt = [...unknownBranches].map(([n, c]) => `${n} (${c})`).join("، ");
    console.log(`تجاهل صفوف فروع غير معروفة في القاعدة: ${txt}`);
  }
  console.log("");

  for (const p of planned) {
    const ov = p.overrides
      .filter((o) => o.minPricePerDayExclTax != null || o.minPriceMonthlyExclTax != null)
      .map(
        (o) =>
          `${branchName.get(o.branchId)}=${fmt(o.minPricePerDayExclTax ?? p.baseDay)}/${fmt(
            o.minPriceMonthlyExclTax ?? p.baseMonth,
          )}`,
      )
      .join("، ");
    console.log(
      `#${p.carModel.id} ${p.g.brand} ${p.g.model} ${p.g.year}: ` +
        `حد يومي ${fmt(p.carModel.minPricePerDayExclTax)} → ${fmt(p.baseDay)} | ` +
        `حد شهري ${fmt(p.carModel.minPriceMonthlyExclTax)} → ${fmt(p.baseMonth)}` +
        (ov ? ` | تجاوزات فروع: ${ov}` : ""),
    );
  }

  if (skipped.length) {
    console.log(`\n⏭️ مستبعد بطلب صريح (--skip):`);
    for (const s of skipped) console.log(`  - ${s.brand} ${s.model} ${s.year}`);
  }

  if (missing.length) {
    console.log(`\n⚠️ موديلات في الملف بلا مقابل في القاعدة (${missing.length}) — لم تُحدَّث:`);
    for (const m of missing) console.log(`  - ${m.brand} ${m.model} ${m.year}`);
  }

  const untouched = models.filter(
    (m) => !planned.some((p) => p.carModel.id === m.id),
  );
  if (untouched.length) {
    console.log(`\nℹ️ موديلات في القاعدة بلا صفوف في الملف (${untouched.length}) — بقيت كما هي:`);
    for (const m of untouched) console.log(`  - #${m.id} ${m.brand.name} ${m.name} ${m.year}`);
  }

  if (warnings.length) {
    console.log(`\n⚠️ تنبيهات مراجعة (${warnings.length}):`);
    for (const w of warnings) console.log(`  - ${w}`);
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
      data: {
        minPricePerDayExclTax: p.baseDay,
        minPriceMonthlyExclTax: p.baseMonth,
      },
    });
    updatedModels++;
    for (const o of p.overrides) {
      const res = await prisma.fleet.updateMany({
        where: { modelId: p.carModel.id, branchId: o.branchId },
        data: {
          minPricePerDayExclTax: o.minPricePerDayExclTax,
          minPriceMonthlyExclTax: o.minPriceMonthlyExclTax,
        },
      });
      if (res.count > 0) {
        if (o.minPricePerDayExclTax != null || o.minPriceMonthlyExclTax != null) setOverrides++;
        else clearedOverrides++;
      }
    }
  }
  console.log(
    `\n✅ تم: ${updatedModels} موديل — ${setOverrides} فرع بتجاوز خاص — ${clearedOverrides} فرع على الحد الأساسي.`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
