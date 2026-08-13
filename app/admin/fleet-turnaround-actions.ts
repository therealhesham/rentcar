"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdminForAction } from "@/lib/admin-access";
import { SITE_KEY_FLEET_TURNAROUND_MINUTES } from "@/lib/site-settings";
import { prisma } from "@/lib/prisma";

/** نفس حدود `getFleetTurnaroundMinutes` — صفر = تسليم فوري، والسقف يوم كامل. */
const MAX_TURNAROUND_MINUTES = 1440;

export async function updateFleetTurnaroundMinutes(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const raw = String(formData.get("minutes") ?? "").trim();
  const minutes = Number(raw);
  if (!raw || !Number.isFinite(minutes) || minutes < 0) {
    return { ok: false, error: "أدخل عدد دقائق صحيحاً (صفر أو أكثر)." };
  }
  if (minutes > MAX_TURNAROUND_MINUTES) {
    return { ok: false, error: "أقصى فترة تجهيز يوم كامل (١٤٤٠ دقيقة)." };
  }

  const value = String(Math.round(minutes));
  try {
    await prisma.siteSetting.upsert({
      where: { key: SITE_KEY_FLEET_TURNAROUND_MINUTES },
      create: { key: SITE_KEY_FLEET_TURNAROUND_MINUTES, value },
      update: { value },
    });
  } catch {
    return { ok: false, error: "تعذّر حفظ الإعداد." };
  }

  revalidatePath("/fleet");
  revalidatePath("/fleet/checkout");
  revalidatePath("/admin/fleet-turnaround");
  return { ok: true };
}
