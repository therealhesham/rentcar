"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function getCarBookingsNotificationSettings(): Promise<{ emails: string; whatsapp: string }> {
  const session = await verifyAdminSession();
  if (!session) {
    return { emails: "", whatsapp: "" };
  }
  
  const [emailsSetting, whatsappSetting] = await Promise.all([
    prisma.siteSetting.findUnique({ where: { key: "car_bookings_emails" } }),
    prisma.siteSetting.findUnique({ where: { key: "maintenance_whatsapp_numbers" } })
  ]);
  
  return {
    emails: emailsSetting?.value || "",
    whatsapp: whatsappSetting?.value || ""
  };
}

export async function updateCarBookingsNotificationSettings(emailsStr: string, whatsappStr: string): Promise<{ ok: boolean; error?: string }> {
  const session = await verifyAdminSession();
  if (!session) {
    return { ok: false, error: "غير مصرح" };
  }

  const emails = emailsStr
    .split(",")
    .map(e => e.trim().toLowerCase())
    .filter(e => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    
  const validEmailsStr = emails.join(",");

  const whatsappNumbers = whatsappStr
    .split(",")
    .map(w => w.replace(/\s/g, "").replace(/\+/g, "").replace(/^00/, "").trim())
    .filter(w => w && /^\d{9,15}$/.test(w));
    
  const validWhatsappStr = whatsappNumbers.join(",");

  try {
    await prisma.$transaction([
      prisma.siteSetting.upsert({
        where: { key: "car_bookings_emails" },
        update: { value: validEmailsStr },
        create: { key: "car_bookings_emails", value: validEmailsStr }
      }),
      prisma.siteSetting.upsert({
        where: { key: "maintenance_whatsapp_numbers" },
        update: { value: validWhatsappStr },
        create: { key: "maintenance_whatsapp_numbers", value: validWhatsappStr }
      })
    ]);
    
    revalidatePath("/admin/car-bookings");
    return { ok: true };
  } catch (error) {
    console.error("Failed to update car bookings notification settings", error);
    return { ok: false, error: "فشل حفظ الإعدادات" };
  }
}
