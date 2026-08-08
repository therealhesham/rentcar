"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdminForAction } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { deleteSpacesObjectByKey } from "@/lib/spaces-upload";

export type GuideFormState = null | { ok: true } | { ok: false; error: string };

/** كل التعديلات هنا لمدير النظام وحده — العرض مفتوح لأي موظف مسجّل دخول. */
const PAGE = "/admin/system-guides";

function text(formData: FormData, key: string): string {
  return (formData.get(key) as string | null)?.trim() ?? "";
}

function intOr(formData: FormData, key: string, fallback: number): number {
  const n = Number.parseInt(formData.get(key) as string, 10);
  return Number.isFinite(n) ? n : fallback;
}

function id(formData: FormData): number | null {
  const n = Number.parseInt(formData.get("id") as string, 10);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// ─── الأقسام ────────────────────────────────────────────────────────────────

export async function createGuideSection(
  _prev: GuideFormState,
  formData: FormData,
): Promise<GuideFormState> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const title = text(formData, "title");
  if (!title) return { ok: false, error: "عنوان القسم مطلوب." };

  await prisma.systemGuideSection.create({
    data: {
      title: title.slice(0, 255),
      description: text(formData, "description") || null,
      sortOrder: intOr(formData, "sortOrder", 0),
    },
  });

  revalidatePath(PAGE);
  return { ok: true };
}

export async function updateGuideSection(
  _prev: GuideFormState,
  formData: FormData,
): Promise<GuideFormState> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const sectionId = id(formData);
  if (!sectionId) return { ok: false, error: "معرّف القسم غير صالح." };
  const title = text(formData, "title");
  if (!title) return { ok: false, error: "عنوان القسم مطلوب." };

  await prisma.systemGuideSection.update({
    where: { id: sectionId },
    data: {
      title: title.slice(0, 255),
      description: text(formData, "description") || null,
      sortOrder: intOr(formData, "sortOrder", 0),
      isActive: formData.get("isActive") === "1",
    },
  });

  revalidatePath(PAGE);
  return { ok: true };
}

export async function deleteGuideSection(
  _prev: GuideFormState,
  formData: FormData,
): Promise<GuideFormState> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const sectionId = id(formData);
  if (!sectionId) return { ok: false, error: "معرّف القسم غير صالح." };

  // نقرأ مفاتيح الملفات قبل الحذف: حذف القسم يجرف شروحاته (cascade) فتضيع المفاتيح.
  const guides = await prisma.systemGuide.findMany({
    where: { sectionId },
    select: { fileKey: true },
  });

  await prisma.systemGuideSection.delete({ where: { id: sectionId } });
  await Promise.all(guides.map((g) => deleteSpacesObjectByKey(g.fileKey)));

  revalidatePath(PAGE);
  return { ok: true };
}

// ─── الشروحات ───────────────────────────────────────────────────────────────

export async function updateSystemGuide(
  _prev: GuideFormState,
  formData: FormData,
): Promise<GuideFormState> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const guideId = id(formData);
  if (!guideId) return { ok: false, error: "معرّف الشرح غير صالح." };
  const title = text(formData, "title");
  if (!title) return { ok: false, error: "عنوان الشرح مطلوب." };

  const sectionId = Number.parseInt(formData.get("sectionId") as string, 10);
  if (!Number.isInteger(sectionId) || sectionId < 1) {
    return { ok: false, error: "اختر القسم." };
  }
  const section = await prisma.systemGuideSection.findUnique({
    where: { id: sectionId },
    select: { id: true },
  });
  if (!section) return { ok: false, error: "القسم غير موجود." };

  await prisma.systemGuide.update({
    where: { id: guideId },
    data: {
      sectionId,
      title: title.slice(0, 255),
      description: text(formData, "description") || null,
      sortOrder: intOr(formData, "sortOrder", 0),
      isActive: formData.get("isActive") === "1",
    },
  });

  revalidatePath(PAGE);
  return { ok: true };
}

export async function deleteSystemGuide(
  _prev: GuideFormState,
  formData: FormData,
): Promise<GuideFormState> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const guideId = id(formData);
  if (!guideId) return { ok: false, error: "معرّف الشرح غير صالح." };

  const guide = await prisma.systemGuide.findUnique({
    where: { id: guideId },
    select: { fileKey: true },
  });
  if (!guide) return { ok: false, error: "الشرح غير موجود." };

  await prisma.systemGuide.delete({ where: { id: guideId } });
  await deleteSpacesObjectByKey(guide.fileKey);

  revalidatePath(PAGE);
  return { ok: true };
}
