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

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];
    const rowNum = i + 2;

    try {
      const brandName = cell(row, mapping.brand);
      const modelName = cell(row, mapping.modelName);
      const priceRaw = cell(row, mapping.price);

      if (!brandName && !modelName && !priceRaw) {
        result.skipped++;
        continue;
      }

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

      const alt = mapping.alt ? cell(row, mapping.alt) || null : null;
      const badge = mapping.badge ? cell(row, mapping.badge) || null : null;
      const image = mapping.image ? cell(row, mapping.image) || null : null;

      const brandKey = brandName.toLowerCase();
      let brandId = brandCache.get(brandKey);
      if (brandId === undefined) {
        const brand = await prisma.brand.upsert({
          where: { name: brandName },
          create: { name: brandName },
          update: {},
          select: { id: true },
        });
        brandId = brand.id;
        brandCache.set(brandKey, brandId);
      }

      const existing = await prisma.carModel.findUnique({
        where: { brandId_name_year: { brandId, name: modelName, year } },
        select: { id: true },
      });

      let modelId: number;

      if (existing) {
        await prisma.carModel.update({
          where: { id: existing.id },
          data: {
            chairs,
            engine,
            transmission,
            fuel,
            price,
            vatRatePercent,
            ...(categoryId !== null && { categoryId }),
            ...(alt !== null && { alt }),
            ...(badge !== null && { badge }),
            ...(image !== null && { image }),
          },
        });
        modelId = existing.id;
        result.updated++;
      } else {
        if (categoryId === null) {
          throw new Error("لإضافة موديل جديد اختر فئة الأسطول من الإعدادات (أو سيُحدَّث الموديل إن كان موجوداً)");
        }
        const created = await prisma.carModel.create({
          data: {
            name: modelName,
            brandId,
            categoryId,
            year,
            chairs,
            engine,
            transmission,
            fuel,
            price,
            vatRatePercent,
            alt,
            badge,
            image,
          },
          select: { id: true },
        });
        modelId = created.id;
        result.created++;
      }

      if (branchId !== null) {
        await prisma.fleet.upsert({
          where: { modelId_branchId: { modelId, branchId } },
          create: { modelId, branchId, quantity },
          update: { quantity },
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
