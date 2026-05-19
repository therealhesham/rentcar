"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireSuperAdminForAction } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function normalizeSlug(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
}

function revalidateCityPaths() {
  revalidatePath("/");
  revalidatePath("/about");
  revalidatePath("/fleet");
  revalidatePath("/fleet/checkout");
  revalidatePath("/admin");
  revalidatePath("/admin/cities");
  revalidatePath("/admin/branches");
}

export async function createCity(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const name = String(formData.get("name") ?? "").trim();
  const slugRaw = String(formData.get("slug") ?? "").trim();
  const sortOrder = Number(formData.get("sortOrder") ?? 0);
  const isActive = String(formData.get("isActive") ?? "true") === "true";

  if (!name) {
    return { ok: false, error: "أدخل اسم المدينة." };
  }
  const slug = normalizeSlug(slugRaw);
  if (!slug || !SLUG_RE.test(slug)) {
    return {
      ok: false,
      error:
        "المعرّف (slug) يجب أن يكون بالإنجليزية: أحرف صغيرة وأرقام وشرطات فقط (مثل: jeddah).",
    };
  }
  if (!Number.isFinite(sortOrder)) {
    return { ok: false, error: "ترتيب العرض غير صالح." };
  }

  try {
    await prisma.city.create({
      data: {
        slug,
        name,
        sortOrder: Math.round(sortOrder),
        isActive,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "توجد مدينة بنفس المعرّف (slug)." };
    }
    console.error(e);
    return { ok: false, error: "تعذّر إنشاء المدينة." };
  }

  revalidateCityPaths();
  return { ok: true };
}

export async function updateCity(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id) || id < 1) {
    return { ok: false, error: "معرّف غير صالح." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const slugRaw = String(formData.get("slug") ?? "").trim();
  const sortOrder = Number(formData.get("sortOrder") ?? 0);
  const isActive = String(formData.get("isActive") ?? "true") === "true";

  if (!name) {
    return { ok: false, error: "أدخل اسم المدينة." };
  }
  const slug = normalizeSlug(slugRaw);
  if (!slug || !SLUG_RE.test(slug)) {
    return {
      ok: false,
      error: "المعرّف (slug) يجب أن يكون بالإنجليزية: أحرف صغيرة وأرقام وشرطات فقط.",
    };
  }
  if (!Number.isFinite(sortOrder)) {
    return { ok: false, error: "ترتيب العرض غير صالح." };
  }

  try {
    await prisma.city.update({
      where: { id },
      data: {
        slug,
        name,
        sortOrder: Math.round(sortOrder),
        isActive,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "توجد مدينة أخرى بنفس المعرّف (slug)." };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { ok: false, error: "المدينة غير موجودة." };
    }
    console.error(e);
    return { ok: false, error: "تعذّر حفظ التعديلات." };
  }

  revalidateCityPaths();
  return { ok: true };
}

export async function deleteCity(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id) || id < 1) {
    return { ok: false, error: "معرّف غير صالح." };
  }

  try {
    const count = await prisma.branch.count({ where: { cityId: id } });
    if (count > 0) {
      return {
        ok: false,
        error: `لا يمكن حذف المدينة: مرتبطة بـ ${count} فرع/فروع. انقل الفروع أو احذفها أولاً.`,
      };
    }
    await prisma.city.delete({ where: { id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { ok: false, error: "المدينة غير موجودة." };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2003") {
      return { ok: false, error: "لا يمكن حذف المدينة لوجود فروع مرتبطة." };
    }
    console.error(e);
    return { ok: false, error: "تعذّر حذف المدينة." };
  }

  revalidateCityPaths();
  return { ok: true };
}
