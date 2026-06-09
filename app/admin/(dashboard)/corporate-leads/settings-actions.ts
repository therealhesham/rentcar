"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export async function getCorporateLeadsEmailsSetting(): Promise<string> {
  const session = await verifyAdminSession();
  if (!session) {
    return "";
  }
  
  const setting = await prisma.siteSetting.findUnique({
    where: { key: "corporate_leads_emails" }
  });
  
  return setting?.value || "";
}

export async function updateCorporateLeadsEmailsSetting(emailsStr: string): Promise<{ ok: boolean; error?: string }> {
  const session = await verifyAdminSession();
  if (!session) {
    return { ok: false, error: "غير مصرح" };
  }

  const emails = emailsStr
    .split(",")
    .map(e => e.trim().toLowerCase())
    .filter(e => e && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e));
    
  const validStr = emails.join(",");

  try {
    await prisma.siteSetting.upsert({
      where: { key: "corporate_leads_emails" },
      update: { value: validStr },
      create: { key: "corporate_leads_emails", value: validStr }
    });
    
    revalidatePath("/admin/corporate-leads");
    return { ok: true };
  } catch (error) {
    console.error("Failed to update corporate_leads_emails", error);
    return { ok: false, error: "فشل حفظ الإعدادات" };
  }
}
