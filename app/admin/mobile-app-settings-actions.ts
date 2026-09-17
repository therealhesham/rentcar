"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdminForAction } from "@/lib/admin-access";
import {
  MOBILE_APP_PAYMENT_METHODS,
  MOBILE_KEY_PAYMENT_METHODS,
  normalizeMobileAppPaymentMethodFlags,
  type MobileAppPaymentMethodFlags,
} from "@/lib/mobile-app-payment-flags";
import {
  MOBILE_APP_BOOKING_WIDGET_PERIODS,
  MOBILE_APP_BOOKING_WIDGET_MODES,
  MOBILE_KEY_BOOKING_WIDGET_TABS,
  normalizeMobileAppBookingWidgetFlags,
  type MobileAppBookingWidgetFlags,
} from "@/lib/mobile-app-booking-widget-flags";
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

export async function updateMobileAppBookingWidgetTabs(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const raw = {} as MobileAppBookingWidgetFlags;
  for (const key of [...MOBILE_APP_BOOKING_WIDGET_PERIODS, ...MOBILE_APP_BOOKING_WIDGET_MODES]) {
    raw[key] = readCheckbox(formData, key);
  }

  const anyPeriod = MOBILE_APP_BOOKING_WIDGET_PERIODS.some((p) => raw[p]);
  if (!anyPeriod) {
    return { ok: false, error: "فعّل تاب إيجار واحد على الأقل في التطبيق." };
  }
  const anyMode = MOBILE_APP_BOOKING_WIDGET_MODES.some((m) => raw[m]);
  if (!anyMode) {
    return { ok: false, error: "فعّل وضع استلام واحد على الأقل في التطبيق." };
  }

  const flags = normalizeMobileAppBookingWidgetFlags(raw);

  try {
    await prisma.mobileAppSetting.upsert({
      where: { key: MOBILE_KEY_BOOKING_WIDGET_TABS },
      create: { key: MOBILE_KEY_BOOKING_WIDGET_TABS, value: JSON.stringify(flags) },
      update: { value: JSON.stringify(flags) },
    });
  } catch {
    return { ok: false, error: "تعذّر حفظ إعدادات التطبيق." };
  }

  revalidatePath("/admin/mobile-app-settings");
  return { ok: true };
}
