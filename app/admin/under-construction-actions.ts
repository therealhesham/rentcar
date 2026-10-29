"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdminForAction } from "@/lib/admin-access";
import { prisma } from "@/lib/prisma";
import {
  SITE_KEY_UNDER_CONSTRUCTION,
  normalizeUnderConstruction,
} from "@/lib/under-construction";

export async function updateUnderConstruction(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const value = JSON.stringify(
    normalizeUnderConstruction({
      enabled: formData.get("enabled") === "on",
      message: String(formData.get("message") ?? ""),
    }),
  );

  try {
    await prisma.siteSetting.upsert({
      where: { key: SITE_KEY_UNDER_CONSTRUCTION },
      create: { key: SITE_KEY_UNDER_CONSTRUCTION, value },
      update: { value },
    });
  } catch {
    return { ok: false, error: "تعذّر حفظ الإعداد." };
  }

  revalidatePath("/admin/under-construction");
  return { ok: true };
}
