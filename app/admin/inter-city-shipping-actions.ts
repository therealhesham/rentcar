"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdminForAction } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";

const CITY_SLUG = /^[a-z0-9-]{1,64}$/;

export type ActionState = { ok?: boolean; error?: string } | null;

export async function createInterCityShippingFee(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };
  const fromSlug = String(formData.get("fromCitySlug") ?? "").trim().toLowerCase();
  const toSlug = String(formData.get("toCitySlug") ?? "").trim().toLowerCase();
  const feeRaw = Number(formData.get("feeExclVatSar"));
  const sortOrder = Number(formData.get("sortOrder") ?? 0);
  const isActive = String(formData.get("isActive") ?? "true") === "true";

  if (!CITY_SLUG.test(fromSlug) || !CITY_SLUG.test(toSlug)) {
    return { ok: false, error: "معرّف المدينة (slug) غير صالح." };
  }
  if (fromSlug === toSlug) {
    return { ok: false, error: "يجب أن تكون مدينة البداية مختلفة عن مدينة الوصول." };
  }
  if (!Number.isInteger(feeRaw) || feeRaw < 0 || feeRaw > 500_000) {
    return { ok: false, error: "المبلغ غير صالح (0–500000 ريال دون ضريبة)." };
  }

  const [fromCity, toCity] = await Promise.all([
    prisma.city.findFirst({ where: { slug: fromSlug, isActive: true } }),
    prisma.city.findFirst({ where: { slug: toSlug, isActive: true } }),
  ]);
  if (!fromCity || !toCity) {
    return { ok: false, error: "إحدى المدينتين غير موجودة أو غير مفعّلة." };
  }

  try {
    await prisma.interCityShippingFee.create({
      data: {
        fromCityId: fromCity.id,
        toCityId: toCity.id,
        feeExclVatSar: feeRaw,
        isActive,
        sortOrder: Number.isFinite(sortOrder) ? Math.round(sortOrder) : 0,
      },
    });
  } catch {
    return {
      ok: false,
      error: "تعذّر الإنشاء — ربما يوجد سعر مسبق لنفس المسار. احذف القديم أو عدّله من قاعدة البيانات.",
    };
  }

  revalidatePath("/admin/inter-city-shipping");
  return { ok: true };
}

export async function deleteInterCityShippingFee(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };
  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id < 1) {
    return { ok: false, error: "معرّف غير صالح." };
  }
  await prisma.interCityShippingFee.delete({ where: { id } }).catch(() => null);
  revalidatePath("/admin/inter-city-shipping");
  return { ok: true };
}

export async function setInterCityShippingFeeActive(
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
  await prisma.interCityShippingFee.update({
    where: { id },
    data: { isActive },
  });
  revalidatePath("/admin/inter-city-shipping");
  return { ok: true };
}
