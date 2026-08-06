"use server";

import { revalidatePath } from "next/cache";
import { requirePermissionForAction } from "@/lib/admin-access";
import {
  SITE_KEY_PRIVACY_POLICY_AR,
  SITE_KEY_PRIVACY_POLICY_EN,
} from "@/lib/site-settings";
import { prisma } from "@/lib/prisma";

const MAX_LENGTH = 20000;

export type PrivacyPolicyFormState = { ok: boolean; error?: string } | null;

export async function updatePrivacyPolicy(
  _prev: PrivacyPolicyFormState,
  formData: FormData,
): Promise<PrivacyPolicyFormState> {
  const auth = await requirePermissionForAction("/admin/privacy-policy");
  if (!auth.ok) return { ok: false, error: auth.error };

  const bodyAr = String(formData.get("bodyAr") ?? "").trim();
  const bodyEn = String(formData.get("bodyEn") ?? "").trim();

  if (bodyAr.length > MAX_LENGTH || bodyEn.length > MAX_LENGTH) {
    return { ok: false, error: `النص طويل جداً (الحد ${MAX_LENGTH} حرف).` };
  }

  try {
    await prisma.$transaction([
      prisma.siteSetting.upsert({
        where: { key: SITE_KEY_PRIVACY_POLICY_AR },
        create: { key: SITE_KEY_PRIVACY_POLICY_AR, value: bodyAr },
        update: { value: bodyAr },
      }),
      prisma.siteSetting.upsert({
        where: { key: SITE_KEY_PRIVACY_POLICY_EN },
        create: { key: SITE_KEY_PRIVACY_POLICY_EN, value: bodyEn },
        update: { value: bodyEn },
      }),
    ]);
  } catch {
    return { ok: false, error: "تعذّر حفظ سياسة الخصوصية." };
  }

  revalidatePath("/admin/privacy-policy");
  revalidatePath("/privacy-policy");
  return { ok: true };
}
