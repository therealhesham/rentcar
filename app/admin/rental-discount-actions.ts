"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireSuperAdminForAction } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { invalidateRentalDiscountCache } from "@/lib/rental-discount";

export type ActionState = { ok: boolean; error?: string };

function parseOptionalId(raw: FormDataEntryValue | null): number | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const n = Number(s);
  return Number.isInteger(n) && n >= 1 ? n : null;
}

function parseOptionalDate(raw: FormDataEntryValue | null): Date | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function revalidateDiscountPaths() {
  invalidateRentalDiscountCache();
  revalidatePath("/fleet");
  revalidatePath("/fleet/checkout");
  revalidatePath("/admin/rental-discounts");
}

export async function createRentalDiscount(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const labelAr = String(formData.get("labelAr") ?? "").trim();
  const kindRaw = String(formData.get("kind") ?? "").trim().toUpperCase();
  const appliesToRaw = String(formData.get("appliesTo") ?? "DAILY_ONLY").trim().toUpperCase();
  const value = Number(formData.get("value"));
  const sortOrder = Number(formData.get("sortOrder") ?? 0);
  const startsAt = parseOptionalDate(formData.get("startsAt"));
  const endsAt = parseOptionalDate(formData.get("endsAt"));
  const brandId = parseOptionalId(formData.get("brandId"));
  const carModelId = parseOptionalId(formData.get("carModelId"));
  const branchId = parseOptionalId(formData.get("branchId"));
  const isActive = formData.get("isActive") === "on" || formData.get("isActive") === "true";

  if (!labelAr) {
    return { ok: false, error: "أدخل اسماً داخلياً للخصم." };
  }
  if (kindRaw !== "PERCENT" && kindRaw !== "FIXED_DAILY") {
    return { ok: false, error: "نوع الخصم غير صالح." };
  }
  if (appliesToRaw !== "DAILY_ONLY" && appliesToRaw !== "DAILY_AND_MONTHLY") {
    return { ok: false, error: "نطاق تطبيق الخصم غير صالح." };
  }
  if (!Number.isFinite(value) || value < 1) {
    return { ok: false, error: "قيمة الخصم غير صالحة." };
  }
  if (kindRaw === "PERCENT" && value > 100) {
    return { ok: false, error: "نسبة الخصم يجب أن تكون بين 1 و 100." };
  }
  if (kindRaw === "FIXED_DAILY" && value > 1_000_000) {
    return { ok: false, error: "مبلغ الخصم اليومي كبير جداً." };
  }
  if (startsAt && endsAt && endsAt.getTime() < startsAt.getTime()) {
    return { ok: false, error: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية." };
  }
  if (carModelId != null && brandId != null) {
    const model = await prisma.carModel.findUnique({
      where: { id: carModelId },
      select: { brandId: true },
    });
    if (!model || model.brandId !== brandId) {
      return { ok: false, error: "الموديل لا ينتمي للماركة المختارة." };
    }
  }
  if (!Number.isFinite(sortOrder)) {
    return { ok: false, error: "ترتيب العرض غير صالح." };
  }

  try {
    await prisma.rentalDiscount.create({
      data: {
        labelAr: labelAr.slice(0, 255),
        kind: kindRaw,
        appliesTo: appliesToRaw,
        value: Math.round(value),
        startsAt,
        endsAt,
        brandId,
        carModelId,
        branchId,
        sortOrder: Math.round(sortOrder),
        isActive,
      },
    });
  } catch (e) {
    console.error(e);
    return { ok: false, error: "تعذّر إنشاء الخصم." };
  }

  revalidateDiscountPaths();
  return { ok: true };
}

export async function updateRentalDiscount(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const id = Number(formData.get("id"));
  const labelAr = String(formData.get("labelAr") ?? "").trim();
  const kindRaw = String(formData.get("kind") ?? "").trim().toUpperCase();
  const appliesToRaw = String(formData.get("appliesTo") ?? "DAILY_ONLY").trim().toUpperCase();
  const value = Number(formData.get("value"));
  const sortOrder = Number(formData.get("sortOrder") ?? 0);
  const startsAt = parseOptionalDate(formData.get("startsAt"));
  const endsAt = parseOptionalDate(formData.get("endsAt"));
  const brandId = parseOptionalId(formData.get("brandId"));
  const carModelId = parseOptionalId(formData.get("carModelId"));
  const branchId = parseOptionalId(formData.get("branchId"));
  const isActive = formData.get("isActive") === "on" || formData.get("isActive") === "true";

  if (!Number.isFinite(id) || id < 1) {
    return { ok: false, error: "معرّف الخصم غير صالح." };
  }
  if (!labelAr) {
    return { ok: false, error: "أدخل اسماً داخلياً للخصم." };
  }
  if (kindRaw !== "PERCENT" && kindRaw !== "FIXED_DAILY") {
    return { ok: false, error: "نوع الخصم غير صالح." };
  }
  if (appliesToRaw !== "DAILY_ONLY" && appliesToRaw !== "DAILY_AND_MONTHLY") {
    return { ok: false, error: "نطاق تطبيق الخصم غير صالح." };
  }
  if (!Number.isFinite(value) || value < 1) {
    return { ok: false, error: "قيمة الخصم غير صالحة." };
  }
  if (kindRaw === "PERCENT" && value > 100) {
    return { ok: false, error: "نسبة الخصم يجب أن تكون بين 1 و 100." };
  }
  if (startsAt && endsAt && endsAt.getTime() < startsAt.getTime()) {
    return { ok: false, error: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية." };
  }
  if (carModelId != null && brandId != null) {
    const model = await prisma.carModel.findUnique({
      where: { id: carModelId },
      select: { brandId: true },
    });
    if (!model || model.brandId !== brandId) {
      return { ok: false, error: "الموديل لا ينتمي للماركة المختارة." };
    }
  }

  try {
    await prisma.rentalDiscount.update({
      where: { id: Math.floor(id) },
      data: {
        labelAr: labelAr.slice(0, 255),
        kind: kindRaw,
        appliesTo: appliesToRaw,
        value: Math.round(value),
        startsAt,
        endsAt,
        brandId,
        carModelId,
        branchId,
        sortOrder: Math.round(sortOrder),
        isActive,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { ok: false, error: "الخصم غير موجود." };
    }
    console.error(e);
    return { ok: false, error: "تعذّر تحديث الخصم." };
  }

  revalidateDiscountPaths();
  revalidatePath(`/admin/rental-discounts/${id}/edit`);
  return { ok: true };
}

export async function deleteRentalDiscount(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id) || id < 1) {
    return { ok: false, error: "معرّف غير صالح." };
  }

  try {
    await prisma.rentalDiscount.delete({ where: { id: Math.floor(id) } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { ok: false, error: "الخصم غير موجود." };
    }
    console.error(e);
    return { ok: false, error: "تعذّر حذف الخصم." };
  }

  revalidateDiscountPaths();
  return { ok: true };
}
