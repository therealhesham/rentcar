"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireSuperAdminForAction } from "@/lib/admin-access";

export async function createBrand(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const name = String(formData.get("name") ?? "").trim();
  const nameEn = String(formData.get("nameEn") ?? "").trim() || null;

  if (!name) {
    return { ok: false, error: "اسم البراند مطلوب." };
  }

  const existing = await prisma.brand.findUnique({
    where: { name },
  });
  if (existing) {
    return { ok: false, error: "يوجد براند آخر بنفس هذا الاسم بالفعل." };
  }

  await prisma.brand.create({
    data: {
      name,
      nameEn,
    },
  });

  revalidatePath("/admin/brands");
  revalidatePath("/admin/vehicles");
  revalidatePath("/fleet");

  return { ok: true };
}

export async function updateBrand(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id) || id < 1) {
    return { ok: false, error: "معرّف البراند غير صالح." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const nameEn = String(formData.get("nameEn") ?? "").trim() || null;

  if (!name) {
    return { ok: false, error: "اسم البراند مطلوب." };
  }

  const conflict = await prisma.brand.findFirst({
    where: {
      name,
      NOT: { id },
    },
  });
  if (conflict) {
    return { ok: false, error: "يوجد براند آخر بنفس هذا الاسم." };
  }

  await prisma.brand.update({
    where: { id },
    data: {
      name,
      nameEn,
    },
  });

  revalidatePath("/admin/brands");
  revalidatePath(`/admin/brands/${id}/edit`);
  revalidatePath("/admin/vehicles");
  revalidatePath("/fleet");

  return { ok: true };
}

export async function deleteBrand(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id) || id < 1) {
    return { ok: false, error: "معرّف البراند غير صالح." };
  }

  const modelCount = await prisma.carModel.count({
    where: { brandId: id },
  });
  if (modelCount > 0) {
    return {
      ok: false,
      error: `لا يمكن حذف البراند لأنه مرتبط بـ ${modelCount} سيارة في الأسطول.`,
    };
  }

  await prisma.brand.delete({
    where: { id },
  });

  revalidatePath("/admin/brands");
  revalidatePath("/admin/vehicles");
  revalidatePath("/fleet");

  return { ok: true };
}
