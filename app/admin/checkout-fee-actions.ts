"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdminForAction } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";

const SLUG = /^[a-z0-9-]{1,64}$/;

export type ActionState = { ok?: boolean; error?: string } | null;

export async function createCheckoutOneTimeFee(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };
  const slug = String(formData.get("slug") ?? "").trim().toLowerCase();
  const labelAr = String(formData.get("labelAr") ?? "").trim();
  const feeRaw = Number(formData.get("feeExclVatSar"));
  const sortOrder = Number(formData.get("sortOrder") ?? 0);
  const isActive = String(formData.get("isActive") ?? "true") === "true";

  if (!SLUG.test(slug)) {
    return { ok: false, error: "المعرّف (slug) غير صالح — أحرف إنجليزية صغيرة وأرقام وشرطة فقط." };
  }
  if (labelAr.length < 2 || labelAr.length > 255) {
    return { ok: false, error: "الاسم بالعربي مطلوب (٢–٢٥٥ حرفاً)." };
  }
  if (!Number.isInteger(feeRaw) || feeRaw < 0 || feeRaw > 500_000) {
    return { ok: false, error: "المبلغ غير صالح (0–500000 ريال دون ضريبة)." };
  }

  try {
    await prisma.checkoutOneTimeFee.create({
      data: {
        slug,
        labelAr,
        feeExclVatSar: feeRaw,
        isActive,
        sortOrder: Number.isFinite(sortOrder) ? Math.round(sortOrder) : 0,
      },
    });
  } catch {
    return {
      ok: false,
      error: "تعذّر الإنشاء — ربما يوجد سطر بنفس الـ slug. استخدم معرّفاً مختلفاً أو احذف القديم.",
    };
  }

  revalidatePath("/admin/checkout-fees");
  return { ok: true };
}

export async function updateCheckoutOneTimeFee(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };
  const id = Number(formData.get("id"));
  const labelAr = String(formData.get("labelAr") ?? "").trim();
  const feeRaw = Number(formData.get("feeExclVatSar"));
  const sortOrder = Number(formData.get("sortOrder") ?? 0);

  if (!Number.isInteger(id) || id < 1) {
    return { ok: false, error: "معرّف غير صالح." };
  }
  if (labelAr.length < 2 || labelAr.length > 255) {
    return { ok: false, error: "الاسم بالعربي مطلوب (٢–٢٥٥ حرفاً)." };
  }
  if (!Number.isInteger(feeRaw) || feeRaw < 0 || feeRaw > 500_000) {
    return { ok: false, error: "المبلغ غير صالح (0–500000 ريال دون ضريبة)." };
  }

  await prisma.checkoutOneTimeFee.update({
    where: { id },
    data: {
      labelAr,
      feeExclVatSar: feeRaw,
      sortOrder: Number.isFinite(sortOrder) ? Math.round(sortOrder) : 0,
    },
  });
  revalidatePath("/admin/checkout-fees");
  return { ok: true };
}

export async function deleteCheckoutOneTimeFee(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id < 1) {
    return { ok: false, error: "معرّف غير صالح." };
  }
  await prisma.checkoutOneTimeFee.delete({ where: { id } }).catch(() => null);
  revalidatePath("/admin/checkout-fees");
  return { ok: true };
}

export async function setCheckoutOneTimeFeeActive(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };
  const id = Number(formData.get("id"));
  const isActive = String(formData.get("isActive") ?? "") === "true";
  if (!Number.isInteger(id) || id < 1) {
    return { ok: false, error: "معرّف غير صالح." };
  }
  await prisma.checkoutOneTimeFee.update({
    where: { id },
    data: { isActive },
  });
  revalidatePath("/admin/checkout-fees");
  return { ok: true };
}
