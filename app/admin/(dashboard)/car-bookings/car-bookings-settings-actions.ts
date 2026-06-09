"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function getCarBookingsWhatsappSetting(): Promise<string> {
  const session = await verifyAdminSession();
  if (!session) {
    return "";
  }
  
  const setting = await prisma.siteSetting.findUnique({
    where: { key: "maintenance_whatsapp_numbers" }
  });
  
  return setting?.value || "";
}

export async function updateCarBookingsWhatsappSetting(whatsappStr: string): Promise<{ ok: boolean; error?: string }> {
  const session = await verifyAdminSession();
  if (!session) {
    return { ok: false, error: "غير مصرح" };
  }

  const whatsappNumbers = whatsappStr
    .split(",")
    .map(w => w.replace(/\s/g, "").replace(/\+/g, "").replace(/^00/, "").trim())
    .filter(w => w && /^\d{9,15}$/.test(w));
    
  const validWhatsappStr = whatsappNumbers.join(",");

  try {
    await prisma.siteSetting.upsert({
      where: { key: "maintenance_whatsapp_numbers" },
      update: { value: validWhatsappStr },
      create: { key: "maintenance_whatsapp_numbers", value: validWhatsappStr }
    });
    
    revalidatePath("/admin/car-bookings");
    return { ok: true };
  } catch (error) {
    console.error("Failed to update maintenance_whatsapp_numbers", error);
    return { ok: false, error: "فشل حفظ الإعدادات" };
  }
}
