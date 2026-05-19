"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { requireSuperAdminForAction } from "@/lib/admin-access";
import { parseBranchOpeningHoursJson } from "@/lib/branch-opening-hours";
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

function normalizePhone(raw: string): string | null {
  const v = raw.trim();
  return v ? v : null;
}

function normalizeMapUrl(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  if (!isHttpsUrl(v)) {
    throw new Error("رابط الخريطة يجب أن يبدأ بـ https://");
  }
  return v;
}

function openingHoursPayloadFromForm(formData: FormData): string | null {
  const raw = String(formData.get("openingHoursJson") ?? "").trim();
  if (!raw) return null;
  const parsed = parseBranchOpeningHoursJson(raw);
  if (!parsed) {
    throw new Error("مواعيد العمل غير صالحة. عطّل التقييد أو راجع الأوقات.");
  }
  return JSON.stringify({ days: parsed.days });
}

function revalidateBranchPaths() {
  revalidatePath("/");
  revalidatePath("/about");
  revalidatePath("/fleet");
  revalidatePath("/fleet/checkout");
  revalidatePath("/admin");
  revalidatePath("/admin/branches");
  revalidatePath("/admin/cities");
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
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const name = String(formData.get("name") ?? "").trim();
  const slugRaw = String(formData.get("slug") ?? "").trim();
  const tagline = String(formData.get("tagline") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  let mapUrl: string | null = null;
  try {
    mapUrl = normalizeMapUrl(String(formData.get("mapUrl") ?? ""));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "رابط الخريطة غير صالح." };
  }
  const alt = String(formData.get("alt") ?? "").trim() || null;
  const sortOrder = Number(formData.get("sortOrder") ?? 0);
  const isActive = String(formData.get("isActive") ?? "true") === "true";
  const isNew = String(formData.get("isNew") ?? "false") === "true";
  const cityId = Number(formData.get("cityId"));

  if (!name) {
    return { ok: false, error: "أدخل اسم الفرع." };
  }
  if (!Number.isFinite(cityId) || cityId < 1) {
    return { ok: false, error: "اختر المدينة." };
  }
  const cityExists = await prisma.city.findUnique({ where: { id: cityId } }).catch(() => null);
  if (!cityExists) {
    return { ok: false, error: "المدينة غير موجودة." };
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

  let openingHoursJson: string | null = null;
  try {
    openingHoursJson = openingHoursPayloadFromForm(formData);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "مواعيد العمل غير صالحة." };
  }

  try {
    await prisma.branch.create({
      data: {
        cityId,
        slug,
        name,
        tagline,
        address,
        phone,
        mapUrl,
        alt,
        image,
        sortOrder: Math.round(sortOrder),
        isActive,
        isNew,
        openingHoursJson,
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
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const id = Number(formData.get("id"));
  if (!Number.isFinite(id) || id < 1) {
    return { ok: false, error: "معرّف غير صالح." };
  }

  const name = String(formData.get("name") ?? "").trim();
  const slugRaw = String(formData.get("slug") ?? "").trim();
  const tagline = String(formData.get("tagline") ?? "").trim() || null;
  const address = String(formData.get("address") ?? "").trim() || null;
  const phone = normalizePhone(String(formData.get("phone") ?? ""));
  let mapUrl: string | null = null;
  try {
    mapUrl = normalizeMapUrl(String(formData.get("mapUrl") ?? ""));
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "رابط الخريطة غير صالح." };
  }
  const alt = String(formData.get("alt") ?? "").trim() || null;
  const sortOrder = Number(formData.get("sortOrder") ?? 0);
  const isActive = String(formData.get("isActive") ?? "true") === "true";
  const isNew = String(formData.get("isNew") ?? "false") === "true";
  const currentImage = String(formData.get("currentImage") ?? "").trim() || null;
  const cityId = Number(formData.get("cityId"));

  if (!name) {
    return { ok: false, error: "أدخل اسم الفرع." };
  }
  if (!Number.isFinite(cityId) || cityId < 1) {
    return { ok: false, error: "اختر المدينة." };
  }
  const cityExists = await prisma.city.findUnique({ where: { id: cityId } }).catch(() => null);
  if (!cityExists) {
    return { ok: false, error: "المدينة غير موجودة." };
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

  let openingHoursJson: string | null = null;
  try {
    openingHoursJson = openingHoursPayloadFromForm(formData);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "مواعيد العمل غير صالحة." };
  }

  try {
    await prisma.branch.update({
      where: { id },
      data: {
        cityId,
        slug,
        name,
        tagline,
        address,
        phone,
        mapUrl,
        alt,
        image,
        sortOrder: Math.round(sortOrder),
        isActive,
        isNew,
        openingHoursJson,
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
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

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
