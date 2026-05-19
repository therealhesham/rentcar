"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdminForAction } from "@/lib/admin-access";
import {
  normalizeBookingWidgetTabFlags,
  type BookingWidgetTabFlags,
} from "@/lib/booking-widget-tabs";
import { prisma } from "@/lib/prisma";
import { SITE_KEY_BOOKING_WIDGET_TABS } from "@/lib/site-settings";

function readCheckbox(formData: FormData, name: string): boolean {
  return formData.get(name) === "on";
}

export async function updateBookingWidgetTabs(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const raw: BookingWidgetTabFlags = {
    rentalDaily: readCheckbox(formData, "rentalDaily"),
    rentalWeekly: readCheckbox(formData, "rentalWeekly"),
    rentalMonthly: readCheckbox(formData, "rentalMonthly"),
    rentalMonthlyPackages: readCheckbox(formData, "rentalMonthlyPackages"),
    rentalCorporate: readCheckbox(formData, "rentalCorporate"),
    modePickup: readCheckbox(formData, "modePickup"),
    modeDelivery: readCheckbox(formData, "modeDelivery"),
  };

  const anyRental =
    raw.rentalDaily ||
    raw.rentalWeekly ||
    raw.rentalMonthly ||
    raw.rentalMonthlyPackages ||
    raw.rentalCorporate;
  if (!anyRental) {
    return { ok: false, error: "فعّل نوع إيجار واحد على الأقل." };
  }

  const needsMode =
    raw.rentalDaily ||
    raw.rentalWeekly ||
    raw.rentalMonthly ||
    raw.rentalMonthlyPackages;
  if (needsMode && !raw.modePickup && !raw.modeDelivery) {
    return {
      ok: false,
      error:
        "فعّل «استلام من الفرع» أو «توصيل لموقعي» (أو الاثنين) عند عرض أي نوع إيجار غير «حجز الشركات».",
    };
  }

  const flags = normalizeBookingWidgetTabFlags(raw);

  try {
    await prisma.siteSetting.upsert({
      where: { key: SITE_KEY_BOOKING_WIDGET_TABS },
      create: { key: SITE_KEY_BOOKING_WIDGET_TABS, value: JSON.stringify(flags) },
      update: { value: JSON.stringify(flags) },
    });
  } catch {
    return { ok: false, error: "تعذّر حفظ الإعداد." };
  }

  revalidatePath("/");
  revalidatePath("/fleet");
  revalidatePath("/admin/booking-widget-tabs");
  return { ok: true };
}
