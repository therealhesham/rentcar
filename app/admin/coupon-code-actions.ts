"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireSuperAdminForAction } from "@/lib/admin-access";
import type { DiscountAppliesTo } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { isDiscountAppliesTo } from "@/lib/discount-scope";

export type ActionState = { ok: boolean; error?: string };

function parseOptionalInt(raw: FormDataEntryValue | null): number | null {
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

function revalidateCouponPaths() {
  revalidatePath("/admin/coupon-codes");
}

function readCouponFormFields(formData: FormData):
  | {
      ok: true;
      data: {
        code: string;
        kind: "PERCENT" | "FIXED";
        value: number;
        scope: "RENTAL_ONLY" | "FULL_TOTAL";
        appliesTo: DiscountAppliesTo;
        canBypassMinPrice: boolean;
        startsAt: Date | null;
        endsAt: Date | null;
        maxUses: number | null;
        perCustomerLimit: number | null;
        isActive: boolean;
      };
    }
  | { ok: false; error: string } {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const kindRaw = String(formData.get("kind") ?? "").trim().toUpperCase();
  const scopeRaw = String(formData.get("scope") ?? "").trim().toUpperCase();
  const appliesToRaw = String(formData.get("appliesTo") ?? "DAILY_ONLY").trim().toUpperCase();
  const canBypassMinPrice =
    formData.get("canBypassMinPrice") === "on" || formData.get("canBypassMinPrice") === "true";
  const value = Number(formData.get("value"));
  const startsAt = parseOptionalDate(formData.get("startsAt"));
  const endsAt = parseOptionalDate(formData.get("endsAt"));
  const maxUses = parseOptionalInt(formData.get("maxUses"));
  const perCustomerLimit = parseOptionalInt(formData.get("perCustomerLimit"));
  const isActive = formData.get("isActive") === "on" || formData.get("isActive") === "true";

  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
    return { ok: false, error: "الكود يجب أن يكون 3–32 حرفاً/رقماً إنجليزياً (يسمح بـ - و _)." };
  }
  if (kindRaw !== "PERCENT" && kindRaw !== "FIXED") {
    return { ok: false, error: "نوع الخصم غير صالح." };
  }
  if (!isDiscountAppliesTo(appliesToRaw)) {
    return { ok: false, error: "نطاق تطبيق الكود غير صالح." };
  }
  if (scopeRaw !== "RENTAL_ONLY" && scopeRaw !== "FULL_TOTAL") {
    return { ok: false, error: "نطاق التطبيق غير صالح." };
  }
  if (!Number.isFinite(value) || value < 1) {
    return { ok: false, error: "قيمة الخصم غير صالحة." };
  }
  if (kindRaw === "PERCENT" && value > 100) {
    return { ok: false, error: "نسبة الخصم يجب أن تكون بين 1 و 100." };
  }
  if (kindRaw === "FIXED" && value > 1_000_000) {
    return { ok: false, error: "مبلغ الخصم كبير جداً." };
  }
  if (startsAt && endsAt && endsAt.getTime() < startsAt.getTime()) {
    return { ok: false, error: "تاريخ النهاية يجب أن يكون بعد تاريخ البداية." };
  }

  return {
    ok: true,
    data: {
      code,
      kind: kindRaw,
      value: Math.round(value),
      scope: scopeRaw,
      appliesTo: appliesToRaw,
      canBypassMinPrice,
      startsAt,
      endsAt,
      maxUses,
      perCustomerLimit,
      isActive,
    },
  };
}

export async function createCouponCode(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const parsed = readCouponFormFields(formData);
  if (!parsed.ok) return parsed;

  try {
    await prisma.couponCode.create({ data: parsed.data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "الكود مستخدم بالفعل." };
    }
    console.error(e);
    return { ok: false, error: "تعذّر إنشاء الكود." };
  }

  revalidateCouponPaths();
  return { ok: true };
}

export async function updateCouponCode(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id) || id < 1) {
    return { ok: false, error: "معرّف الكود غير صالح." };
  }

  const parsed = readCouponFormFields(formData);
  if (!parsed.ok) return parsed;

  try {
    await prisma.couponCode.update({ where: { id: Math.floor(id) }, data: parsed.data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { ok: false, error: "الكود غير موجود." };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "الكود مستخدم بالفعل." };
    }
    console.error(e);
    return { ok: false, error: "تعذّر تحديث الكود." };
  }

  revalidateCouponPaths();
  revalidatePath(`/admin/coupon-codes/${id}/edit`);
  return { ok: true };
}

export async function deleteCouponCode(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id) || id < 1) {
    return { ok: false, error: "معرّف غير صالح." };
  }

  const usesCount = await prisma.couponRedemption.count({ where: { couponCodeId: Math.floor(id) } });
  if (usesCount > 0) {
    return { ok: false, error: "لا يمكن حذف كود له استخدامات مسجّلة — عطّله بدلاً من الحذف." };
  }

  try {
    await prisma.couponCode.delete({ where: { id: Math.floor(id) } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { ok: false, error: "الكود غير موجود." };
    }
    console.error(e);
    return { ok: false, error: "تعذّر حذف الكود." };
  }

  revalidateCouponPaths();
  return { ok: true };
}
