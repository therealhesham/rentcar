"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { verifyAdminSession } from "@/lib/admin-auth";
import { requireGalleryFolderSlug } from "@/lib/gallery-folder";
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

function isHttpsUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "https:";
  } catch {
    return false;
  }
}

function revalidateBranchPaths() {
  revalidatePath("/");
  revalidatePath("/admin");
  revalidatePath("/admin/branches");
}

async function resolveImageFromForm(
  formData: FormData,
  currentImage: string | null | undefined,
): Promise<string | null> {
  const imageFile = formData.get("imageFile");
  const galleryImageUrl = String(formData.get("galleryImageUrl") ?? "").trim();
  const imageUrlRaw = String(formData.get("imageUrl") ?? "").trim();

  if (imageFile instanceof File && imageFile.size > 0) {
    if (!isSpacesConfigured()) {
      throw new Error(
        "لم يُضبط تخزين Spaces في البيئة (SPACES_REGION، المفاتيح، SPACES_BUCKET).",
      );
    }
    await requireGalleryFolderSlug("branches");
    return await uploadImageToSpaces(imageFile, "branches");
  }
  if (galleryImageUrl && isTrustedSpacesImageUrl(galleryImageUrl)) {
    return galleryImageUrl;
  }
  if (imageUrlRaw) {
    if (!isHttpsUrl(imageUrlRaw)) {
      throw new Error("رابط الصورة يجب أن يبدأ بـ https://");
    }
    return imageUrlRaw;
  }
  return currentImage ?? null;
}

export async function createBranch(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await verifyAdminSession())) {
    return { ok: false, error: "غير مصرّح." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const slugRaw = String(formData.get("slug") ?? "").trim();
  const tagline = String(formData.get("tagline") ?? "").trim() || null;
  const alt = String(formData.get("alt") ?? "").trim() || null;
  const sortOrder = Number(formData.get("sortOrder") ?? 0);
  const isActive = String(formData.get("isActive") ?? "true") === "true";
  const isNew = String(formData.get("isNew") ?? "false") === "true";

  if (!name) {
    return { ok: false, error: "أدخل اسم الفرع." };
  }
  const slug = normalizeSlug(slugRaw);
  if (!slug || !SLUG_RE.test(slug)) {
    return {
      ok: false,
      error:
        "المعرّف (slug) يجب أن يكون بالإنجليزية: أحرف صغيرة وأرقام وشرطات فقط (مثل: jeddah أو north-1).",
    };
  }
  if (!Number.isFinite(sortOrder)) {
    return { ok: false, error: "ترتيب العرض غير صالح." };
  }

  let image: string | null = null;
  try {
    image = await resolveImageFromForm(formData, null);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "فشل معالجة الصورة.";
    return { ok: false, error: msg };
  }

  try {
    await prisma.branch.create({
      data: {
        slug,
        name,
        tagline,
        alt,
        image,
        sortOrder: Math.round(sortOrder),
        isActive,
        isNew,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "يوجد فرع بنفس المعرّف (slug)." };
    }
    console.error(e);
    return { ok: false, error: "تعذّر إنشاء الفرع." };
  }

  revalidateBranchPaths();
  return { ok: true };
}

export async function updateBranch(
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

  const name = String(formData.get("name") ?? "").trim();
  const slugRaw = String(formData.get("slug") ?? "").trim();
  const tagline = String(formData.get("tagline") ?? "").trim() || null;
  const alt = String(formData.get("alt") ?? "").trim() || null;
  const sortOrder = Number(formData.get("sortOrder") ?? 0);
  const isActive = String(formData.get("isActive") ?? "true") === "true";
  const isNew = String(formData.get("isNew") ?? "false") === "true";
  const currentImage = String(formData.get("currentImage") ?? "").trim() || null;

  if (!name) {
    return { ok: false, error: "أدخل اسم الفرع." };
  }
  const slug = normalizeSlug(slugRaw);
  if (!slug || !SLUG_RE.test(slug)) {
    return {
      ok: false,
      error:
        "المعرّف (slug) يجب أن يكون بالإنجليزية: أحرف صغيرة وأرقام وشرطات فقط.",
    };
  }
  if (!Number.isFinite(sortOrder)) {
    return { ok: false, error: "ترتيب العرض غير صالح." };
  }

  let image: string | null;
  try {
    image = await resolveImageFromForm(formData, currentImage);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "فشل معالجة الصورة.";
    return { ok: false, error: msg };
  }

  try {
    await prisma.branch.update({
      where: { id },
      data: {
        slug,
        name,
        tagline,
        alt,
        image,
        sortOrder: Math.round(sortOrder),
        isActive,
        isNew,
      },
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return { ok: false, error: "يوجد فرع آخر بنفس المعرّف (slug)." };
    }
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { ok: false, error: "الفرع غير موجود." };
    }
    console.error(e);
    return { ok: false, error: "تعذّر حفظ التعديلات." };
  }

  revalidateBranchPaths();
  return { ok: true };
}

export async function deleteBranch(
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

  try {
    await prisma.branch.delete({ where: { id } });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { ok: false, error: "الفرع غير موجود." };
    }
    console.error(e);
    return { ok: false, error: "تعذّر حذف الفرع." };
  }

  revalidateBranchPaths();
  return { ok: true };
}
