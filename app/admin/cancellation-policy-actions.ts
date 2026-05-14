"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/admin-auth";
import { parseCancellationDeductTiersFromAdminForm } from "@/lib/cancellation-deduct";
import {
  SITE_KEY_CUSTOMER_CANCEL_MIN_HOURS_BEFORE_PICKUP,
  SITE_KEY_CUSTOMER_CANCELLATION_DEDUCT_TIERS_JSON,
  SITE_KEY_CUSTOMER_CANCELLATION_POLICY_AR,
} from "@/lib/site-settings";
import { prisma } from "@/lib/prisma";

const MAX_HOURS = 720;

export type CancellationPolicyFormState = { ok: boolean; error?: string } | null;

export async function updateCustomerCancellationPolicy(
  _prev: CancellationPolicyFormState,
  formData: FormData,
): Promise<CancellationPolicyFormState> {
  if (!(await verifyAdminSession())) {
    return { ok: false, error: "غير مصرّح." };
  }

  const policyAr = String(formData.get("policyAr") ?? "").trim();
  if (policyAr.length > 8000) {
    return { ok: false, error: "نص السياسات طويل جداً (الحد ٨٠٠٠ حرف)." };
  }

  const rawHours = String(formData.get("minHoursBeforePickup") ?? "").trim();
  const n = rawHours === "" ? 0 : Number(rawHours);
  if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > MAX_HOURS) {
    return {
      ok: false,
      error: `عدد الساعات يجب أن يكون عدداً صحيحاً بين ٠ و ${MAX_HOURS}، أو اتركه فارغاً ليعني بدون مهلة.`,
    };
  }

  const rawTiersJson = String(formData.get("deductTiersJson") ?? "");
  const parsedTiers = parseCancellationDeductTiersFromAdminForm(rawTiersJson);
  if (!parsedTiers.ok) {
    return { ok: false, error: parsedTiers.error };
  }

  try {
    await prisma.$transaction([
      prisma.siteSetting.upsert({
        where: { key: SITE_KEY_CUSTOMER_CANCELLATION_POLICY_AR },
        create: { key: SITE_KEY_CUSTOMER_CANCELLATION_POLICY_AR, value: policyAr },
        update: { value: policyAr },
      }),
      prisma.siteSetting.upsert({
        where: { key: SITE_KEY_CUSTOMER_CANCEL_MIN_HOURS_BEFORE_PICKUP },
        create: { key: SITE_KEY_CUSTOMER_CANCEL_MIN_HOURS_BEFORE_PICKUP, value: String(n) },
        update: { value: String(n) },
      }),
      prisma.siteSetting.upsert({
        where: { key: SITE_KEY_CUSTOMER_CANCELLATION_DEDUCT_TIERS_JSON },
        create: {
          key: SITE_KEY_CUSTOMER_CANCELLATION_DEDUCT_TIERS_JSON,
          value: JSON.stringify(parsedTiers.tiers),
        },
        update: { value: JSON.stringify(parsedTiers.tiers) },
      }),
    ]);
  } catch {
    return { ok: false, error: "تعذّر حفظ الإعدادات." };
  }

  revalidatePath("/account");
  revalidatePath("/admin/cancellation-policy");
  return { ok: true };
}
