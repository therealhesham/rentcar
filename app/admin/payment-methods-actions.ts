"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdminForAction } from "@/lib/admin-access";
import {
  CUSTOMER_CHECKOUT_PAYMENT_METHODS,
  normalizeCheckoutPaymentMethodFlags,
  type CheckoutPaymentMethodFlags,
} from "@/lib/checkout-payment-method-flags";
import { prisma } from "@/lib/prisma";
import { SITE_KEY_CHECKOUT_PAYMENT_METHODS } from "@/lib/site-settings";

function readCheckbox(formData: FormData, name: string): boolean {
  return formData.get(name) === "on";
}

export async function updateCheckoutPaymentMethods(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const raw = {} as CheckoutPaymentMethodFlags;
  for (const method of CUSTOMER_CHECKOUT_PAYMENT_METHODS) {
    raw[method] = readCheckbox(formData, method);
  }

  const anyEnabled = CUSTOMER_CHECKOUT_PAYMENT_METHODS.some((m) => raw[m]);
  if (!anyEnabled) {
    return { ok: false, error: "فعّل طريقة دفع واحدة على الأقل للعميل." };
  }

  const flags = normalizeCheckoutPaymentMethodFlags(raw);

  try {
    await prisma.siteSetting.upsert({
      where: { key: SITE_KEY_CHECKOUT_PAYMENT_METHODS },
      create: { key: SITE_KEY_CHECKOUT_PAYMENT_METHODS, value: JSON.stringify(flags) },
      update: { value: JSON.stringify(flags) },
    });
  } catch {
    return { ok: false, error: "تعذّر حفظ الإعداد." };
  }

  revalidatePath("/admin/payment-methods");
  revalidatePath("/fleet/payment/[id]", "page");
  return { ok: true };
}
