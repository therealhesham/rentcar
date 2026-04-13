"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { verifyAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import {
  isSpacesConfigured,
  isTrustedSpacesImageUrl,
  uploadImageToSpaces,
} from "@/lib/spaces-upload";

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

function revalidateCategoryPaths() {
  revalidatePath("/");
  revalidatePath("/fleet");
  revalidatePath("/admin");
  revalidatePath("/admin/categories");
}

export async function createFleetCategory(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await verifyAdminSession())) {
    return { ok: false, error: "غير مصرّح." };
  }

  const title = String(formData.get("title") ?? "").trim();
  const slugRaw = String(formData.get("slug") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const imageFile = formData.get("imageFile");
  const galleryImageUrl = String(formData.get("galleryImageUrl") ?? "").trim();
  const alt = String(formData.get("alt") ?? "").trim() || null;
  const sortOrder = Number(formData.get("sortOrder") ?? 0);

  if (!title) {
    return { ok: false, error: "أدخل عنوان الفئة." };
  }
  const slug = normalizeSlug(slugRaw);
  if (!slug || !SLUG_RE.test(slug)) {
    return {
      ok: false,
      error:
        "المعرّف (slug) يجب أن يكون بالإنجليزية: أحرف صغيرة وأرقام وشرطات فقط (مثل: luxury-suv).",
    };
  }
  if (!description) {
    return { ok: false, error: "أدخل وصف الفئة." };
  }
  if (!Number.isFinite(sortOrder)) {
    return { ok: false, error: "ترتيب العرض غير صالح." };
  }

  if (!isSpacesConfigured()) {
    return {
      ok: false,
      error:
        "لم يُضبط تخزين Spaces في البيئة (SPACES_REGION، المفاتيح، SPACES_BUCKET).",
    };
  }

  let imageUrl: string | null = null;
  if (imageFile instanceof File && imageFile.size > 0) {
    try {
      imageUrl = await uploadImageToSpaces(imageFile, "categories");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "فشل رفع الصورة.";
      return { ok: false, error: msg };
    }
  } else if (galleryImageUrl && isTrustedSpacesImageUrl(galleryImageUrl)) {
    imageUrl = galleryImageUrl;
  }
  if (!imageUrl) {
    return { ok: false, error: "اختر صورة من المعرض أو ارفع ملفاً للفئة." };
  }

  try {
    await prisma.fleetCategory.create({
      data: {
        slug,
        title,
        description,
        image: imageUrl,
        alt,
        sortOrder: Math.round(sortOrder),
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "يوجد فئة بنفس المعرّف (slug)." };
    }
    console.error(e);
    return { ok: false, error: "تعذّر إنشاء الفئة." };
  }

  revalidateCategoryPaths();
  return { ok: true };
}

export async function updateFleetCategory(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await verifyAdminSession())) {
    return { ok: false, error: "غير مصرّح." };
  }

  const id = Number(formData.get("id"));
  const title = String(formData.get("title") ?? "").trim();
  const slugRaw = String(formData.get("slug") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const imageFile = formData.get("imageFile");
  const galleryImageUrl = String(formData.get("galleryImageUrl") ?? "").trim();
  const currentImage = String(formData.get("currentImage") ?? "").trim();
  const alt = String(formData.get("alt") ?? "").trim() || null;
  const sortOrder = Number(formData.get("sortOrder") ?? 0);

  if (!Number.isFinite(id) || id < 1) {
    return { ok: false, error: "معرّف الفئة غير صالح." };
  }
  if (!title) {
    return { ok: false, error: "أدخل عنوان الفئة." };
  }
  const slug = normalizeSlug(slugRaw);
  if (!slug || !SLUG_RE.test(slug)) {
    return {
      ok: false,
      error:
        "المعرّف (slug) يجب أن يكون بالإنجليزية: أحرف صغيرة وأرقام وشرطات فقط.",
    };
  }
  if (!description) {
    return { ok: false, error: "أدخل وصف الفئة." };
  }
  if (!Number.isFinite(sortOrder)) {
    return { ok: false, error: "ترتيب العرض غير صالح." };
  }

  let imageUrl = currentImage;
  if (imageFile instanceof File && imageFile.size > 0) {
    if (!isSpacesConfigured()) {
      return {
        ok: false,
        error:
          "لم يُضبط تخزين Spaces في البيئة (SPACES_REGION، المفاتيح، SPACES_BUCKET).",
      };
    }
    try {
      imageUrl = await uploadImageToSpaces(imageFile, "categories");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "فشل رفع الصورة.";
      return { ok: false, error: msg };
    }
  } else if (galleryImageUrl && isTrustedSpacesImageUrl(galleryImageUrl)) {
    imageUrl = galleryImageUrl;
  }
  if (!imageUrl) {
    return { ok: false, error: "ارفع صورة جديدة أو احتفظ بالصورة الحالية." };
  }

  try {
    await prisma.fleetCategory.update({
      where: { id: Math.floor(id) },
      data: {
        slug,
        title,
        description,
        image: imageUrl,
        alt,
        sortOrder: Math.round(sortOrder),
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "يوجد فئة أخرى بنفس المعرّف (slug)." };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { ok: false, error: "الفئة غير موجودة." };
    }
    console.error(e);
    return { ok: false, error: "تعذّر تحديث الفئة." };
  }

  revalidateCategoryPaths();
  return { ok: true };
}

export async function deleteFleetCategory(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await verifyAdminSession())) {
    return { ok: false, error: "غير مصرّح." };
  }

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id) || id < 1) {
    return { ok: false, error: "معرّف غير صالح." };
  }

  const cat = await prisma.fleetCategory.findUnique({
    where: { id: Math.floor(id) },
    include: { _count: { select: { models: true } } },
  });

  if (!cat) {
    return { ok: false, error: "الفئة غير موجودة." };
  }
  if (cat._count.models > 0) {
    return {
      ok: false,
      error:
        "لا يمكن حذف الفئة لوجود سيارات مرتبطة بها. انقل الموديلات لفئة أخرى أو احذفها أولاً.",
    };
  }

  try {
    await prisma.fleetCategory.delete({
      where: { id: Math.floor(id) },
    });
  } catch (e) {
    console.error(e);
    return { ok: false, error: "تعذّر حذف الفئة." };
  }

  revalidateCategoryPaths();
  return { ok: true };
}
