"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireSuperAdminForAction } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";

export type ActionState = { ok: boolean; error?: string };

function parseOptionalDate(raw: FormDataEntryValue | null): Date | null {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function revalidateCustomizedCouponPaths() {
  revalidatePath("/admin/customized-coupons");
}

function readCustomizedCouponFormFields(formData: FormData):
  | {
    ok: true;
    data: {
      code: string;
      customerPhone: string;
      kind: "PERCENT" | "FIXED";
      value: number;
      scope: "RENTAL_ONLY" | "FULL_TOTAL";
      canBypassMinPrice: boolean;
      endsAt: Date | null;
      isActive: boolean;
    };
  }
  | { ok: false; error: string } {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  const localPhone = String(formData.get("customerPhone") ?? "").replace(/\s+/g, "").trim();
  const kindRaw = String(formData.get("kind") ?? "").trim().toUpperCase();
  const scopeRaw = String(formData.get("scope") ?? "").trim().toUpperCase();
  const value = Number(formData.get("value"));
  const canBypassMinPrice =
    formData.get("canBypassMinPrice") === "on" || formData.get("canBypassMinPrice") === "true";
  const endsAt = parseOptionalDate(formData.get("endsAt"));
  const isActive = formData.get("isActive") === "on" || formData.get("isActive") === "true";

  if (!/^[A-Z0-9_-]{3,32}$/.test(code)) {
    return { ok: false, error: "الكود يجب أن يكون 3–32 حرفاً/رقماً إنجليزياً (يسمح بـ - و _)." };
  }
  if (!/^5\d{8}$/.test(localPhone)) {
    return { ok: false, error: "رقم الجوال غير صالح — أدخله بصيغة 5xxxxxxxx (بدون +966)." };
  }
  if (kindRaw !== "PERCENT" && kindRaw !== "FIXED") {
    return { ok: false, error: "نوع الخصم غير صالح." };
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

  return {
    ok: true,
    data: {
      code,
      customerPhone: `+966${localPhone}`,
      kind: kindRaw,
      value: Math.round(value),
      scope: scopeRaw,
      canBypassMinPrice,
      endsAt,
      isActive,
    },
  };
}

export async function createCustomizedCoupon(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const parsed = readCustomizedCouponFormFields(formData);
  if (!parsed.ok) return parsed;

  try {
    await prisma.customizedCoupon.create({ data: parsed.data });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "هذا الكود مُخصَّص لهذا العميل بالفعل." };
    }
    console.error(e);
    return { ok: false, error: "تعذّر إنشاء الكود." };
  }

  revalidateCustomizedCouponPaths();
  return { ok: true };
}

export async function updateCustomizedCoupon(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id) || id < 1) {
    return { ok: false, error: "معرّف الكود غير صالح." };
  }

  const parsed = readCustomizedCouponFormFields(formData);
  if (!parsed.ok) return parsed;

  try {
    // الكود ورقم الجوال مقفولان بعد الإنشاء (يمثّلان هوية الكود)؛ التحديث يمسّ
    // باقي الحقول فقط، فنُبقي القيمتين الأصليتين بدل قيم الفورم المعطَّلة.
    await prisma.customizedCoupon.update({
      where: { id: Math.floor(id) },
      data: {
        kind: parsed.data.kind,
        value: parsed.data.value,
        scope: parsed.data.scope,
        canBypassMinPrice: parsed.data.canBypassMinPrice,
        endsAt: parsed.data.endsAt,
        isActive: parsed.data.isActive,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { ok: false, error: "الكود غير موجود." };
    }
    console.error(e);
    return { ok: false, error: "تعذّر تحديث الكود." };
  }

  revalidateCustomizedCouponPaths();
  revalidatePath(`/admin/customized-coupons/${id}/edit`);
  return { ok: true };
}

export async function deleteCustomizedCoupon(
  _prev: ActionState | null,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id) || id < 1) {
    return { ok: false, error: "معرّف غير صالح." };
  }

  const row = await prisma.customizedCoupon.findUnique({
    where: { id: Math.floor(id) },
    select: { isUsed: true },
  });
  if (row?.isUsed) {
    return { ok: false, error: "لا يمكن حذف كود مُستخدَم بالفعل — عطّله بدلاً من الحذف." };
  }

  try {
    await prisma.customizedCoupon.delete({ where: { id: Math.floor(id) } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { ok: false, error: "الكود غير موجود." };
    }
    console.error(e);
    return { ok: false, error: "تعذّر حذف الكود." };
  }

  revalidateCustomizedCouponPaths();
  return { ok: true };
}
