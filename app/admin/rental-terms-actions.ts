"use server";

import { requirePermissionForAction } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import { revalidatePath } from "next/cache";

export type TermFormState =
  | null
  | { ok: true }
  | { ok: false; error: string };

// ─── Create ────────────────────────────────────────────────────────────────

export async function createRentalTerm(
  _prev: TermFormState,
  formData: FormData,
): Promise<TermFormState> {
  const auth = await requirePermissionForAction("/admin/rental-terms");
  if (!auth.ok) return { ok: false, error: auth.error };

  const titleAr = (formData.get("titleAr") as string | null)?.trim() ?? "";
  const titleEn = (formData.get("titleEn") as string | null)?.trim() || null;
  const bodyAr = (formData.get("bodyAr") as string | null)?.trim() ?? "";
  const bodyEn = (formData.get("bodyEn") as string | null)?.trim() || null;
  const sortOrder = Number.parseInt(formData.get("sortOrder") as string, 10) || 0;

  if (!titleAr) return { ok: false, error: "العنوان بالعربية مطلوب." };
  if (!bodyAr) return { ok: false, error: "نص الشرط بالعربية مطلوب." };

  await prisma.rentalTerm.create({
    data: { titleAr, titleEn, bodyAr, bodyEn, sortOrder },
  });

  revalidatePath("/admin/rental-terms");
  return { ok: true };
}

// ─── Update ─────────────────────────────────────────────────────────────────

export async function updateRentalTerm(
  _prev: TermFormState,
  formData: FormData,
): Promise<TermFormState> {
  const auth = await requirePermissionForAction("/admin/rental-terms");
  if (!auth.ok) return { ok: false, error: auth.error };

  const id = Number.parseInt(formData.get("id") as string, 10);
  const titleAr = (formData.get("titleAr") as string | null)?.trim() ?? "";
  const titleEn = (formData.get("titleEn") as string | null)?.trim() || null;
  const bodyAr = (formData.get("bodyAr") as string | null)?.trim() ?? "";
  const bodyEn = (formData.get("bodyEn") as string | null)?.trim() || null;
  const sortOrder = Number.parseInt(formData.get("sortOrder") as string, 10) || 0;
  const isActive = formData.get("isActive") === "1";

  if (!titleAr) return { ok: false, error: "العنوان بالعربية مطلوب." };
  if (!bodyAr) return { ok: false, error: "نص الشرط بالعربية مطلوب." };

  await prisma.rentalTerm.update({
    where: { id },
    data: { titleAr, titleEn, bodyAr, bodyEn, sortOrder, isActive },
  });

  revalidatePath("/admin/rental-terms");
  return { ok: true };
}

// ─── Delete ─────────────────────────────────────────────────────────────────

export async function deleteRentalTerm(
  _prev: TermFormState,
  formData: FormData,
): Promise<TermFormState> {
  const auth = await requirePermissionForAction("/admin/rental-terms");
  if (!auth.ok) return { ok: false, error: auth.error };

  const id = Number.parseInt(formData.get("id") as string, 10);
  await prisma.rentalTerm.delete({ where: { id } });

  revalidatePath("/admin/rental-terms");
  return { ok: true };
}
