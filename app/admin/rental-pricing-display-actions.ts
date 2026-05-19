"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdminForAction } from "@/lib/admin-access";
import { SITE_KEY_RENTAL_PRICE_DISPLAY } from "@/lib/site-settings";
import { parseRentalPriceDisplayMode } from "@/lib/pricing";
import { prisma } from "@/lib/prisma";

export async function updateRentalPriceDisplay(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const raw = String(formData.get("mode") ?? "").trim();
  const mode = parseRentalPriceDisplayMode(raw);

  try {
    await prisma.siteSetting.upsert({
      where: { key: SITE_KEY_RENTAL_PRICE_DISPLAY },
      create: { key: SITE_KEY_RENTAL_PRICE_DISPLAY, value: mode },
      update: { value: mode },
    });
  } catch {
    return { ok: false, error: "تعذّر حفظ الإعداد." };
  }

  revalidatePath("/fleet");
  revalidatePath("/fleet/checkout");
  revalidatePath("/admin/rental-pricing-display");
  return { ok: true };
}
