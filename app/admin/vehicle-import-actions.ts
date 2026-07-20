"use server";

import { revalidatePath } from "next/cache";
import type { FuelType, Transmission } from "@prisma/client";
import { requireSuperAdminForAction } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import type { ImportRow } from "@/lib/vehicle-import-excel";

export type { ImportRow } from "@/lib/vehicle-import-excel";

/** كل الحقول اختيارية — يُستخدم فقط ما ربطه المستخدم في الواجهة. */
export type FieldMapping = {
  brand?: string;
  modelName?: string;
  year?: string;
  chairs?: string;
  engine?: string;
  transmission?: string;
  fuel?: string;
  price?: string;
  vatRatePercent?: string;
  quantity?: string;
  /** عمود اسم الفرع لكل صف — عند ربطه يُفعَّل وضع «فرع لكل صف» مع تسعير الفروع. */
  branch?: string;
  alt?: string;
  badge?: string;
  image?: string;
};

export type ImportResult = {
  total: number;
  created: number;
  updated: number;
  skipped: number;
  errors: { row: number; message: string }[];
};

function cell(row: ImportRow, col?: string): string {
  if (!col) return "";
  return (row[col] ?? "").trim();
}

function parseTransmission(raw: string): Transmission {
  const v = raw.trim().toLowerCase();
  if (
    v === "manual" ||
    v === "m" ||
    v.includes("يدوي") ||
    v.includes("عادي")
  ) {
    return "MANUAL";
  }
  return "AUTOMATIC";
}

function parseFuel(raw: string): FuelType {
  const v = raw.trim().toLowerCase();
  if (v === "diesel" || v.includes("ديزل")) return "DIESEL";
  if (v === "hybrid" || v.includes("هجين")) return "HYBRID";
  if (v === "electric" || v === "ev" || v.includes("كهرب")) return "ELECTRIC";
  if (v === "gasoline" || v === "petrol" || v === "gas" || v.includes("بنزين")) {
    return "GASOLINE";
  }
  return "GASOLINE";
}

/** القيمة الأكثر تكراراً (وعند التساوي: الأكبر) — لاختيار السعر الأساسي للموديل. */
function mode(nums: number[]): number {
  const freq = new Map<number, number>();
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

/** حقول موديل مُستخرجة من صف واحد. */
type ParsedRowModel = {
  brandName: string;
  modelName: string;
  year: number;
  chairs: number;
  engine: string;
  transmission: Transmission;
  fuel: FuelType;
  price: number;
  vatRatePercent: number;
  quantity: number;
  alt: string | null;
  badge: string | null;
  image: string | null;
};

/** يستخرج حقول الموديل من صف؛ يرمي خطأً عند نقص إلزامي، أو null لصف فارغ كلياً. */
function parseRow(
  row: ImportRow,
  mapping: FieldMapping,
  defaultYear: number,
): ParsedRowModel | null {
  const brandName = cell(row, mapping.brand);
  const modelName = cell(row, mapping.modelName);
  const priceRaw = cell(row, mapping.price);

  if (!brandName && !modelName && !priceRaw) return null;
  if (!brandName) throw new Error("اسم الماركة فارغ");
  if (!modelName) throw new Error("اسم الموديل فارغ");

  const yearStr = cell(row, mapping.year).replace(/[^\d]/g, "");
  const yearParsed = parseInt(yearStr, 10);
  const year =
    Number.isFinite(yearParsed) && yearParsed >= 1990 && yearParsed <= 2035
      ? yearParsed
      : defaultYear;

  const chairsStr = cell(row, mapping.chairs).replace(/[^\d]/g, "");
  const chairsParsed = parseInt(chairsStr, 10);
  const chairs =
    Number.isFinite(chairsParsed) && chairsParsed >= 1 && chairsParsed <= 99
      ? chairsParsed
      : 5;

  const engine = cell(row, mapping.engine) || "غير محدد";
  const transmission = parseTransmission(cell(row, mapping.transmission));
  const fuel = parseFuel(cell(row, mapping.fuel));

  const priceStr = priceRaw.replace(/[,\s]/g, "").replace(/[^\d.]/g, "");
  const price = Math.round(parseFloat(priceStr));
  if (!Number.isFinite(price) || price < 1) {
    throw new Error(
      mapping.price
        ? `سعر غير صالح: "${priceRaw}"`
        : "لم يُربط عمود السعر أو القيمة فارغة",
    );
  }

  const vatRatePercent = mapping.vatRatePercent
    ? parseInt(cell(row, mapping.vatRatePercent).replace(/[^\d]/g, ""), 10) || 15
    : 15;

  const quantity = mapping.quantity
    ? parseInt(cell(row, mapping.quantity).replace(/[^\d]/g, ""), 10) || 1
    : 1;

  return {
    brandName,
    modelName,
    year,
    chairs,
    engine,
    transmission,
    fuel,
    price,
    vatRatePercent,
    quantity,
    alt: mapping.alt ? cell(row, mapping.alt) || null : null,
    badge: mapping.badge ? cell(row, mapping.badge) || null : null,
    image: mapping.image ? cell(row, mapping.image) || null : null,
  };
}

/** يوحّد اسم فرع للمطابقة: يزيل «فرع» البادئة والمسافات ويصغّر الأحرف. */
function normalizeBranchName(s: string): string {
  return s
    .trim()
    .replace(/^فرع\s+/, "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

/** يبني حلّال اسم فرع → id: بالاسم أولاً، ثم باسم المدينة لو المدينة بها فرع واحد. */
async function buildBranchResolver(): Promise<(name: string) => number | null> {
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true, city: { select: { name: true } } },
  });
  const byName = new Map<string, number>();
  const cityCounts = new Map<string, number>();
  for (const b of branches) {
    byName.set(normalizeBranchName(b.name), b.id);
    if (b.city?.name) {
      const c = normalizeBranchName(b.city.name);
      cityCounts.set(c, (cityCounts.get(c) ?? 0) + 1);
    }
  }
  const byCity = new Map<string, number>();
  for (const b of branches) {
    if (!b.city?.name) continue;
    const c = normalizeBranchName(b.city.name);
    if (cityCounts.get(c) === 1) byCity.set(c, b.id);
  }
  return (name: string) => {
    const n = normalizeBranchName(name);
    if (!n) return null;
    return byName.get(n) ?? byCity.get(n) ?? null;
  };
}

async function upsertModel(
  m: ParsedRowModel,
  basePrice: number,
  categoryId: number | null,
  brandCache: Map<string, number>,
): Promise<{ modelId: number; created: boolean }> {
  const brandKey = m.brandName.toLowerCase();
  let brandId = brandCache.get(brandKey);
  if (brandId === undefined) {
    const brand = await prisma.brand.upsert({
      where: { name: m.brandName },
      create: { name: m.brandName },
      update: {},
      select: { id: true },
    });
    brandId = brand.id;
    brandCache.set(brandKey, brandId);
  }

  const existing = await prisma.carModel.findUnique({
    where: { brandId_name_year: { brandId, name: m.modelName, year: m.year } },
    select: { id: true },
  });

  if (existing) {
    await prisma.carModel.update({
      where: { id: existing.id },
      data: {
        chairs: m.chairs,
        engine: m.engine,
        transmission: m.transmission,
        fuel: m.fuel,
        price: basePrice,
        vatRatePercent: m.vatRatePercent,
        ...(categoryId !== null && { categoryId }),
        ...(m.alt !== null && { alt: m.alt }),
        ...(m.badge !== null && { badge: m.badge }),
        ...(m.image !== null && { image: m.image }),
      },
    });
    return { modelId: existing.id, created: false };
  }

  if (categoryId === null) {
    throw new Error(
      "لإضافة موديل جديد اختر فئة الأسطول من الإعدادات (أو سيُحدَّث الموديل إن كان موجوداً)",
    );
  }
  const created = await prisma.carModel.create({
    data: {
      name: m.modelName,
      brandId,
      categoryId,
      year: m.year,
      chairs: m.chairs,
      engine: m.engine,
      transmission: m.transmission,
      fuel: m.fuel,
      price: basePrice,
      vatRatePercent: m.vatRatePercent,
      alt: m.alt,
      badge: m.badge,
      image: m.image,
    },
    select: { id: true },
  });
  return { modelId: created.id, created: true };
}

/**
 * وضع «فرع لكل صف»: يجمّع الصفوف حسب (ماركة+موديل+سنة)، السعر الأساسي = الأكثر
 * تكراراً، ويسجّل تجاوز سعر الفرع عند الاختلاف — بنفس منطق سكربت CSV.
 */
async function importWithPerRowBranch(
  rows: ImportRow[],
  mapping: FieldMapping,
  categoryId: number | null,
  brandCache: Map<string, number>,
  result: ImportResult,
): Promise<void> {
  const defaultYear = new Date().getFullYear();
  const resolveBranch = await buildBranchResolver();

  type BranchAgg = { prices: number[]; quantity: number };
  type Group = {
    sample: ParsedRowModel;
    allPrices: number[];
    branches: Map<number, BranchAgg>;
  };
  const groups = new Map<string, Group>();

  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    try {
      const parsed = parseRow(rows[i], mapping, defaultYear);
      if (!parsed) {
        result.skipped++;
        continue;
      }
      const branchId = resolveBranch(cell(rows[i], mapping.branch));
      if (branchId == null) {
        // فرع غير معروف (ورشة/تأمين/اسم لا يطابق) — يُتخطّى ولا يؤثر على السعر الأساسي
        result.skipped++;
        continue;
      }
      const key = `${parsed.brandName.toLowerCase()}|${parsed.modelName}|${parsed.year}`;
      let g = groups.get(key);
      if (!g) {
        g = { sample: parsed, allPrices: [], branches: new Map() };
        groups.set(key, g);
      }
      g.allPrices.push(parsed.price);
      let ba = g.branches.get(branchId);
      if (!ba) {
        ba = { prices: [], quantity: 0 };
        g.branches.set(branchId, ba);
      }
      ba.prices.push(parsed.price);
      // كل صف = وحدة سيارة ما لم يُربط عمود كمية صريح
      ba.quantity += parsed.quantity;
    } catch (err) {
      result.errors.push({
        row: rowNum,
        message: err instanceof Error ? err.message : "خطأ غير متوقع",
      });
      result.skipped++;
    }
  }

  for (const g of groups.values()) {
    try {
      const basePrice = Math.round(mode(g.allPrices));
      const { modelId, created } = await upsertModel(
        g.sample,
        basePrice,
        categoryId,
        brandCache,
      );

      if (created) result.created++;
      else result.updated++;

      for (const [branchId, ba] of g.branches) {
        const branchPrice = Math.round(mode(ba.prices));
        const override = branchPrice === basePrice ? null : branchPrice;
        await prisma.fleet.upsert({
          where: { modelId_branchId: { modelId, branchId } },
          create: {
            modelId,
            branchId,
            quantity: ba.quantity,
            pricePerDayExclTax: override,
          },
          update: { quantity: ba.quantity, pricePerDayExclTax: override },
        });
      }
    } catch (err) {
      result.errors.push({
        row: 0,
        message: `${g.sample.brandName} ${g.sample.modelName} ${g.sample.year}: ${
          err instanceof Error ? err.message : "خطأ غير متوقع"
        }`,
      });
    }
  }
}

export async function importVehiclesFromExcel(payload: {
  rows: ImportRow[];
  mapping: FieldMapping;
  categoryId?: number | null;
  branchId?: number | null;
}): Promise<ImportResult> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) {
    return {
      total: 0,
      created: 0,
      updated: 0,
      skipped: 0,
      errors: [{ row: 0, message: auth.error }],
    };
  }

  const { rows, mapping } = payload;
  const categoryId = payload.categoryId ?? null;
  const branchId = payload.branchId ?? null;
  const defaultYear = new Date().getFullYear();

  const result: ImportResult = {
    total: rows.length,
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  const brandCache = new Map<string, number>();

  // وضع «فرع لكل صف»: مُفعَّل عند ربط عمود الفرع — يتولّى التسعير لكل فرع.
  if (mapping.branch) {
    await importWithPerRowBranch(rows, mapping, categoryId, brandCache, result);
    revalidatePath("/admin/vehicles");
    revalidatePath("/fleet");
    return result;
  }

  // الوضع الكلاسيكي: فرع واحد للملف كله (من القائمة) — السعر يذهب لسعر الموديل الأساسي.
  for (let i = 0; i < rows.length; i++) {
    const rowNum = i + 2;
    try {
      const parsed = parseRow(rows[i], mapping, defaultYear);
      if (!parsed) {
        result.skipped++;
        continue;
      }
      const { modelId, created } = await upsertModel(
        parsed,
        parsed.price,
        categoryId,
        brandCache,
      );
      if (created) result.created++;
      else result.updated++;

      if (branchId !== null) {
        await prisma.fleet.upsert({
          where: { modelId_branchId: { modelId, branchId } },
          create: { modelId, branchId, quantity: parsed.quantity },
          update: { quantity: parsed.quantity },
        });
      }
    } catch (err) {
      result.errors.push({
        row: rowNum,
        message: err instanceof Error ? err.message : "خطأ غير متوقع",
      });
      result.skipped++;
    }
  }

  revalidatePath("/admin/vehicles");
  return result;
}
