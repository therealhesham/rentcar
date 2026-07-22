/**
 * مطابقة كاملة لمخزون وأسعار الأسطول من ملف CSV (اسعار الاولين):
 *   node scripts/import-fleet-full.mjs "<csv-path>" [--apply]
 *
 * القاعدة: المخزون بعد التشغيل = بالضبط ما في الملف.
 * - لكل (ماركة+موديل+سنة): يُنشأ الموديل لو غير موجود (فئة افتراضية «سيدان»، بدون صورة)،
 *   ويُحدَّث السعر اليومي والشهري الأساسيين (الأكثر تكراراً بين كل الصفوف) دائماً.
 * - لكل (موديل+فرع): الكمية = عدد صفوف هذا الموديل في هذا الفرع بالملف (كل صف = وحدة).
 *   السعر اليومي/الشهري الخاص بالفرع = الأكثر تكراراً في الفرع؛ يُحفظ فقط لو يختلف عن السعر الأساسي.
 *   عمود «سعر الشهر» اختياري — موديل بدون سعر شهري في كل صفوفه يبقى priceMonthlyExclTax = null.
 * - أي صف Fleet (موديل+فرع) موجود حالياً في القاعدة ولم يظهر في الملف بهذا التشغيل ← كميته 0.
 * - صفوف الورش/التأمين (فرع غير معروف) تُتجاهل من حساب الكميات، وتُحسب ضمن الأسعار الأساسية فقط.
 */
import fs from "node:fs";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_CATEGORY_ID = 1; // سيدان — نفس الفئة الافتراضية لكل الموديلات الحالية تقريباً

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

function normalizeBranchName(s) {
  return s
    .trim()
    .replace(/^فرع\s+/, "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

/** يزيل بادئة «المدينة - » / «جدة -» إلخ ويرجّع الجزء بعد آخر شرطة (- أو – أو —) إن وُجدت. */
function stripCityPrefix(s) {
  const parts = s.split(/[-–—]/);
  return parts.length > 1 ? parts[parts.length - 1].trim() : s.trim();
}

async function buildBranchResolver() {
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true, city: { select: { name: true } } },
  });
  const byName = new Map();
  const cityCounts = new Map();
  for (const b of branches) {
    byName.set(normalizeBranchName(b.name), b.id);
    if (b.city?.name) {
      const c = normalizeBranchName(b.city.name);
      cityCounts.set(c, (cityCounts.get(c) ?? 0) + 1);
    }
  }
  const byCity = new Map();
  for (const b of branches) {
    if (!b.city?.name) continue;
    const c = normalizeBranchName(b.city.name);
    if (cityCounts.get(c) === 1) byCity.set(c, b.id);
  }
  return (raw) => {
    const stripped = stripCityPrefix(raw);
    const n = normalizeBranchName(stripped);
    if (!n) return null;
    return byName.get(n) ?? byCity.get(n) ?? null;
  };
}

function findHeaderIndex(headers, exact, fallbackContains) {
  let i = headers.findIndex((h) => h.trim() === exact);
  if (i !== -1) return i;
  if (fallbackContains) {
    i = headers.findIndex((h) => h.includes(fallbackContains));
    if (i !== -1) return i;
  }
  return -1;
}

async function main() {
  const [csvPath, ...flags] = process.argv.slice(2);
  const apply = flags.includes("--apply");
  if (!csvPath) {
    console.error("Usage: node scripts/import-fleet-full.mjs <csv> [--apply]");
    process.exit(1);
  }

  const lines = fs
    .readFileSync(csvPath, "utf8")
    .split(/\r?\n/)
    .filter((l) => l.trim());
  const headers = lines[0].split(",");
  const idx = {
    branch: findHeaderIndex(headers, "اسم الفرع", "فرع"),
    brand: findHeaderIndex(headers, "الطراز"),
    model: findHeaderIndex(headers, "النوع"),
    year: findHeaderIndex(headers, "الموديل"),
    price: findHeaderIndex(headers, "سعر اليوم"),
  };
  for (const [k, v] of Object.entries(idx)) {
    if (v === -1) throw new Error(`لم يُعثر على عمود "${k}" في رأس الملف`);
  }
  // عمود السعر الشهري اختياري — لو غير موجود نتجاهله بهدوء (كل الأسعار الشهرية تبقى null)
  const monthlyIdx = findHeaderIndex(headers, "سعر الشهر");

  const rows = lines.slice(1).map((l) => l.split(","));
  const resolveBranch = await buildBranchResolver();

  // key = brand|model|year
  const groups = new Map();
  let skippedNoBranch = 0;
  let skippedBadRow = 0;

  for (const r of rows) {
    if (r.length <= Math.max(...Object.values(idx))) {
      skippedBadRow++;
      continue;
    }
    const brand = (r[idx.brand] ?? "").trim();
    const model = (r[idx.model] ?? "").trim();
    const year = Number((r[idx.year] ?? "").trim());
    const dayPrice = Number((r[idx.price] ?? "").trim());
    if (!brand || !model || !Number.isInteger(year)) {
      skippedBadRow++;
      continue;
    }
    if (!Number.isFinite(dayPrice) || dayPrice <= 0) {
      skippedBadRow++;
      continue;
    }
    const monthlyPriceRaw = monthlyIdx !== -1 ? Number((r[monthlyIdx] ?? "").trim()) : NaN;
    const monthlyPrice = Number.isFinite(monthlyPriceRaw) && monthlyPriceRaw > 0 ? monthlyPriceRaw : null;

    const key = `${brand}|${model}|${year}`;
    if (!groups.has(key)) {
      groups.set(key, {
        brand,
        model,
        year,
        allPrices: [],
        allMonthlyPrices: [],
        branchRows: new Map(),
        branchMonthlyRows: new Map(),
      });
    }
    const g = groups.get(key);
    g.allPrices.push(dayPrice);
    if (monthlyPrice != null) g.allMonthlyPrices.push(monthlyPrice);

    const branchId = resolveBranch((r[idx.branch] ?? "").trim());
    if (branchId == null) {
      skippedNoBranch++;
      continue;
    }
    if (!g.branchRows.has(branchId)) g.branchRows.set(branchId, []);
    g.branchRows.get(branchId).push(dayPrice);
    if (monthlyPrice != null) {
      if (!g.branchMonthlyRows.has(branchId)) g.branchMonthlyRows.set(branchId, []);
      g.branchMonthlyRows.get(branchId).push(monthlyPrice);
    }
  }

  console.log(
    `صفوف الملف: ${rows.length} — مجموعات موديل/سنة: ${groups.size} — تجاهل ${skippedNoBranch} صف (فرع غير معروف) و${skippedBadRow} صف بيانات ناقصة/سعر غير صالح.\n`,
  );

  const categories = await prisma.fleetCategory.findMany({ select: { id: true } });
  const hasDefaultCategory = categories.some((c) => c.id === DEFAULT_CATEGORY_ID);
  if (!hasDefaultCategory) throw new Error(`فئة الأسطول الافتراضية #${DEFAULT_CATEGORY_ID} غير موجودة`);

  const branchNameById = new Map(
    (await prisma.branch.findMany({ select: { id: true, name: true } })).map((b) => [b.id, b.name]),
  );

  // desiredFleet: `${modelId}:${branchId}` -> quantity (تُبنى بعد حسم CarModel لكل مجموعة)
  const desiredFleet = new Map();
  const planned = [];
  let toCreate = 0;
  let toUpdatePrice = 0;

  for (const g of groups.values()) {
    // موديل مذكور فقط في صفوف ورش/تأمين (بدون فرع حقيقي) — لا داعي لإنشائه أو تحديثه
    if (g.branchRows.size === 0) continue;

    const basePrice = Math.round(mode(g.allPrices));
    const baseMonthlyPrice = g.allMonthlyPrices.length > 0 ? Math.round(mode(g.allMonthlyPrices)) : null;
    const brandRow = await prisma.brand.upsert({
      where: { name: g.brand },
      create: { name: g.brand },
      update: {},
      select: { id: true },
    });
    let carModel = await prisma.carModel.findFirst({
      where: { brandId: brandRow.id, name: g.model, year: g.year },
      select: { id: true, price: true, priceMonthlyExclTax: true },
    });
    const willCreate = !carModel;
    if (willCreate) toCreate++;
    else if (carModel.price !== basePrice || carModel.priceMonthlyExclTax !== baseMonthlyPrice) {
      toUpdatePrice++;
    }

    const branchPlan = [];
    for (const [branchId, prices] of g.branchRows) {
      const quantity = prices.length;
      const branchPrice = Math.round(mode(prices));
      const priceOverride = branchPrice === basePrice ? null : branchPrice;
      const monthlyPrices = g.branchMonthlyRows.get(branchId) ?? [];
      const branchMonthlyPrice = monthlyPrices.length > 0 ? Math.round(mode(monthlyPrices)) : null;
      const monthlyOverride =
        branchMonthlyPrice != null && branchMonthlyPrice !== baseMonthlyPrice ? branchMonthlyPrice : null;
      branchPlan.push({
        branchId,
        quantity,
        priceOverride,
        monthlyOverride,
        branchName: branchNameById.get(branchId),
      });
    }

    planned.push({ g, willCreate, basePrice, baseMonthlyPrice, branchPlan, carModelId: carModel?.id ?? null });

    if (!apply) continue; // تُحسم CarModel الفعلية فقط عند التطبيق

    if (willCreate) {
      const created = await prisma.carModel.create({
        data: {
          name: g.model,
          brandId: brandRow.id,
          categoryId: DEFAULT_CATEGORY_ID,
          year: g.year,
          chairs: 5,
          engine: "غير محدد",
          transmission: "AUTOMATIC",
          fuel: "GASOLINE",
          price: basePrice,
          priceMonthlyExclTax: baseMonthlyPrice,
          vatRatePercent: 15,
        },
        select: { id: true },
      });
      carModel = { id: created.id, price: basePrice, priceMonthlyExclTax: baseMonthlyPrice };
    } else if (carModel.price !== basePrice || carModel.priceMonthlyExclTax !== baseMonthlyPrice) {
      await prisma.carModel.update({
        where: { id: carModel.id },
        data: { price: basePrice, priceMonthlyExclTax: baseMonthlyPrice },
      });
    }

    for (const bp of branchPlan) {
      desiredFleet.set(`${carModel.id}:${bp.branchId}`, true);
      await prisma.fleet.upsert({
        where: { modelId_branchId: { modelId: carModel.id, branchId: bp.branchId } },
        create: {
          modelId: carModel.id,
          branchId: bp.branchId,
          quantity: bp.quantity,
          pricePerDayExclTax: bp.priceOverride,
          priceMonthlyExclTax: bp.monthlyOverride,
        },
        update: {
          quantity: bp.quantity,
          pricePerDayExclTax: bp.priceOverride,
          priceMonthlyExclTax: bp.monthlyOverride,
        },
      });
    }
  }

  // ─── تقرير المعاينة ──────────────────────────────────────────────────────────
  for (const p of planned) {
    const label = `${p.g.brand} ${p.g.model} ${p.g.year}`;
    const status = p.willCreate ? "[جديد]" : "";
    const branchesTxt = p.branchPlan
      .map((bp) => {
        const daily = `${bp.branchName}=${bp.quantity}${bp.priceOverride != null ? `@${bp.priceOverride}` : ""}`;
        return bp.monthlyOverride != null ? `${daily} (شهري ${bp.monthlyOverride})` : daily;
      })
      .join("، ");
    const monthlyTxt = p.baseMonthlyPrice != null ? ` — سعر شهري أساسي ${p.baseMonthlyPrice}` : "";
    console.log(
      `${label} ${status} — سعر أساسي ${p.basePrice}${monthlyTxt} — فروع: ${branchesTxt || "لا يوجد"}`,
    );
  }

  if (!apply) {
    console.log(
      `\n(معاينة فقط) موديلات جديدة: ${toCreate} — موديلات سيُحدَّث سعرها: ${toUpdatePrice}`,
    );
    console.log("أعد التشغيل مع --apply للتطبيق (سيشمل أيضاً تصفير أي فرع/موديل غير موجود في الملف).");
    return;
  }

  // ─── تصفير أي Fleet موجود حالياً وغير مذكور في الملف ────────────────────────
  const existingFleet = await prisma.fleet.findMany({
    where: { quantity: { gt: 0 } },
    select: { modelId: true, branchId: true, quantity: true },
  });
  let zeroedCount = 0;
  for (const f of existingFleet) {
    const key = `${f.modelId}:${f.branchId}`;
    if (!desiredFleet.has(key)) {
      await prisma.fleet.update({
        where: { modelId_branchId: { modelId: f.modelId, branchId: f.branchId } },
        data: { quantity: 0 },
      });
      zeroedCount++;
    }
  }

  console.log(
    `\n✅ تم: ${toCreate} موديل جديد — ${toUpdatePrice} سعر أساسي مُحدَّث — ${zeroedCount} صف مخزون صُفِّر (غير موجود في الملف).`,
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
