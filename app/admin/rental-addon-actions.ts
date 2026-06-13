"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireSuperAdminForAction } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { normalizeRentalAddonExclusiveGroup } from "@/lib/rental-addon-exclusive";

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

function parseIconKey(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (!/^[a-z0-9-]{1,32}$/.test(v)) return null;
  return v.slice(0, 32);
}

function revalidateAddonPaths() {
  revalidatePath("/fleet/checkout");
  revalidatePath("/admin/rental-addons");
}

export async function createRentalAddon(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const slug = normalizeSlug(String(formData.get("slug") ?? ""));
  const titleAr = String(formData.get("titleAr") ?? "").trim();
  const titleEn = String(formData.get("titleEn") ?? "").trim() || null;
  const descriptionAr = String(formData.get("descriptionAr") ?? "").trim() || null;
  const descriptionEn = String(formData.get("descriptionEn") ?? "").trim() || null;
  const infoAr = String(formData.get("infoAr") ?? "").trim() || null;
  const infoEn = String(formData.get("infoEn") ?? "").trim() || null;
  const pricePerDay = Number(formData.get("pricePerDay"));
  const sortOrder = Number(formData.get("sortOrder") ?? 0);
  const iconKey = parseIconKey(String(formData.get("iconKey") ?? ""));
  const exclusiveGroupRaw = String(formData.get("exclusiveGroup") ?? "").trim();
  const exclusiveGroup = exclusiveGroupRaw
    ? normalizeRentalAddonExclusiveGroup(exclusiveGroupRaw)
    : null;
  const isActive = formData.get("isActive") === "on";

  if (!titleAr) {
    return { ok: false, error: "أدخل عنوان الإضافة بالعربية." };
  }
  if (!slug || !SLUG_RE.test(slug)) {
    return {
      ok: false,
      error:
        "المعرّف (slug) بالإنجليزية: أحرف صغيرة وأرقام وشرطات فقط (مثل: child-seat).",
    };
  }
  if (exclusiveGroupRaw && !exclusiveGroup) {
    return {
      ok: false,
      error:
        "مجموعة التعارض: أحرف إنجليزية صغيرة وأرقام وشرطات فقط (مثل: key-protection)، أو اتركها فارغة.",
    };
  }
  if (!Number.isFinite(pricePerDay) || pricePerDay < 0 || pricePerDay > 1_000_000) {
    return { ok: false, error: "السعر اليومي غير صالح (0 أو أكبر)." };
  }
  if (!Number.isFinite(sortOrder)) {
    return { ok: false, error: "ترتيب العرض غير صالح." };
  }

  try {
    await prisma.rentalAddon.create({
      data: {
        slug,
        titleAr: titleAr.slice(0, 255),
        titleEn: titleEn ? titleEn.slice(0, 255) : null,
        descriptionAr,
        descriptionEn,
        infoAr,
        infoEn,
        pricePerDay: Math.floor(pricePerDay),
        iconKey,
        exclusiveGroup,
        sortOrder: Math.round(sortOrder),
        isActive,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "يوجد إضافة بنفس المعرّف (slug)." };
    }
    console.error(e);
    return { ok: false, error: "تعذّر إنشاء الإضافة." };
  }

  revalidateAddonPaths();
  return { ok: true };
}

export async function updateRentalAddon(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const id = Number(formData.get("id"));
  const slug = normalizeSlug(String(formData.get("slug") ?? ""));
  const titleAr = String(formData.get("titleAr") ?? "").trim();
  const titleEn = String(formData.get("titleEn") ?? "").trim() || null;
  const descriptionAr = String(formData.get("descriptionAr") ?? "").trim() || null;
  const descriptionEn = String(formData.get("descriptionEn") ?? "").trim() || null;
  const infoAr = String(formData.get("infoAr") ?? "").trim() || null;
  const infoEn = String(formData.get("infoEn") ?? "").trim() || null;
  const pricePerDay = Number(formData.get("pricePerDay"));
  const sortOrder = Number(formData.get("sortOrder") ?? 0);
  const iconKey = parseIconKey(String(formData.get("iconKey") ?? ""));
  const exclusiveGroupRaw = String(formData.get("exclusiveGroup") ?? "").trim();
  const exclusiveGroup = exclusiveGroupRaw
    ? normalizeRentalAddonExclusiveGroup(exclusiveGroupRaw)
    : null;
  const isActive = formData.get("isActive") === "on";

  if (!Number.isFinite(id) || id < 1) {
    return { ok: false, error: "معرّف الإضافة غير صالح." };
  }
  if (!titleAr) {
    return { ok: false, error: "أدخل عنوان الإضافة بالعربية." };
  }
  if (!slug || !SLUG_RE.test(slug)) {
    return {
      ok: false,
      error:
        "المعرّف (slug) بالإنجليزية: أحرف صغيرة وأرقام وشرطات فقط.",
    };
  }
  if (exclusiveGroupRaw && !exclusiveGroup) {
    return {
      ok: false,
      error:
        "مجموعة التعارض: أحرف إنجليزية صغيرة وأرقام وشرطات فقط، أو اتركها فارغة.",
    };
  }
  if (!Number.isFinite(pricePerDay) || pricePerDay < 0 || pricePerDay > 1_000_000) {
    return { ok: false, error: "السعر اليومي غير صالح." };
  }
  if (!Number.isFinite(sortOrder)) {
    return { ok: false, error: "ترتيب العرض غير صالح." };
  }

  try {
    await prisma.rentalAddon.update({
      where: { id: Math.floor(id) },
      data: {
        slug,
        titleAr: titleAr.slice(0, 255),
        titleEn: titleEn ? titleEn.slice(0, 255) : null,
        descriptionAr,
        descriptionEn,
        infoAr,
        infoEn,
        pricePerDay: Math.floor(pricePerDay),
        iconKey,
        exclusiveGroup,
        sortOrder: Math.round(sortOrder),
        isActive,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "يوجد إضافة أخرى بنفس المعرّف (slug)." };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { ok: false, error: "الإضافة غير موجودة." };
    }
    console.error(e);
    return { ok: false, error: "تعذّر تحديث الإضافة." };
  }

  revalidateAddonPaths();
  revalidatePath(`/admin/rental-addons/${id}/edit`);
  return { ok: true };
}

export async function deleteRentalAddon(
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
    await prisma.rentalAddon.delete({
      where: { id: Math.floor(id) },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { ok: false, error: "الإضافة غير موجودة." };
    }
    console.error(e);
    return { ok: false, error: "تعذّر حذف الإضافة." };
  }

  revalidateAddonPaths();
  return { ok: true };
}
