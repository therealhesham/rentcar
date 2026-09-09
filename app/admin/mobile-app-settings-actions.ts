"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdminForAction } from "@/lib/admin-access";
import {
  MOBILE_APP_PAYMENT_METHODS,
  MOBILE_KEY_PAYMENT_METHODS,
  normalizeMobileAppPaymentMethodFlags,
  type MobileAppPaymentMethodFlags,
} from "@/lib/mobile-app-payment-flags";
import { prisma } from "@/lib/prisma";

function readCheckbox(formData: FormData, name: string): boolean {
  return formData.get(name) === "on";
}

export async function updateMobileAppPaymentMethods(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const raw = {} as MobileAppPaymentMethodFlags;
  for (const method of MOBILE_APP_PAYMENT_METHODS) {
    raw[method] = readCheckbox(formData, method);
  }

  const anyEnabled = MOBILE_APP_PAYMENT_METHODS.some((m) => raw[m]);
  if (!anyEnabled) {
    return { ok: false, error: "فعّل طريقة دفع واحدة على الأقل في التطبيق." };
  }

  const flags = normalizeMobileAppPaymentMethodFlags(raw);

  try {
    await prisma.mobileAppSetting.upsert({
      where: { key: MOBILE_KEY_PAYMENT_METHODS },
      create: { key: MOBILE_KEY_PAYMENT_METHODS, value: JSON.stringify(flags) },
      update: { value: JSON.stringify(flags) },
    });
  } catch {
    return { ok: false, error: "تعذّر حفظ إعدادات التطبيق." };
  }

  revalidatePath("/admin/mobile-app-settings");
  return { ok: true };
}
