"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdminForAction } from "@/lib/admin-access";
import {
  normalizeKycDocRequirements,
  type KycDocRequirements,
} from "@/lib/kyc-doc-requirements";
import { prisma } from "@/lib/prisma";
import { SITE_KEY_KYC_DOC_REQUIREMENTS } from "@/lib/site-settings";

export async function updateKycDocRequirements(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const raw: KycDocRequirements = {
    idImage: String(formData.get("idImage") ?? ""),
    licenseImage: String(formData.get("licenseImage") ?? ""),
  } as unknown as KycDocRequirements;

  const flags = normalizeKycDocRequirements(raw);

  try {
    await prisma.siteSetting.upsert({
      where: { key: SITE_KEY_KYC_DOC_REQUIREMENTS },
      create: { key: SITE_KEY_KYC_DOC_REQUIREMENTS, value: JSON.stringify(flags) },
      update: { value: JSON.stringify(flags) },
    });
  } catch {
    return { ok: false, error: "تعذّر حفظ الإعداد." };
  }

  revalidatePath("/admin/kyc-doc-requirements");
  revalidatePath("/fleet/checkout");
  return { ok: true };
}
