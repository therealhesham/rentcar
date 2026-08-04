"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { CONTACT_MESSAGES_EMAILS_KEY, isContactMessageStatus } from "@/lib/contact-messages";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function getContactNotificationEmails(): Promise<string> {
  if (!(await verifyAdminSession())) return "";
  const setting = await prisma.siteSetting.findUnique({
    where: { key: CONTACT_MESSAGES_EMAILS_KEY },
  });
  return setting?.value ?? "";
}

export async function updateContactNotificationEmails(
  emailsStr: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await verifyAdminSession())) {
    return { ok: false, error: "غير مصرح" };
  }

  const value = emailsStr
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter((e) => e && EMAIL_RE.test(e))
    .join(",");

  try {
    await prisma.siteSetting.upsert({
      where: { key: CONTACT_MESSAGES_EMAILS_KEY },
      update: { value },
      create: { key: CONTACT_MESSAGES_EMAILS_KEY, value },
    });
    revalidatePath("/admin/contact-messages");
    return { ok: true };
  } catch (error) {
    console.error("[contact-messages] فشل حفظ إعدادات الإشعارات", error);
    return { ok: false, error: "فشل حفظ الإعدادات" };
  }
}

export async function updateContactMessageStatus(
  id: number,
  status: string,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await verifyAdminSession())) {
    return { ok: false, error: "غير مصرح" };
  }
  if (!Number.isInteger(id) || id <= 0 || !isContactMessageStatus(status)) {
    return { ok: false, error: "بيانات غير صالحة" };
  }

  try {
    await prisma.contactMessage.update({ where: { id }, data: { status } });
    revalidatePath("/admin/contact-messages");
    return { ok: true };
  } catch (error) {
    console.error("[contact-messages] فشل تحديث حالة الرسالة", error);
    return { ok: false, error: "فشل تحديث حالة الرسالة" };
  }
}

export async function deleteContactMessage(id: number): Promise<{ ok: boolean; error?: string }> {
  if (!(await verifyAdminSession())) {
    return { ok: false, error: "غير مصرح" };
  }
  if (!Number.isInteger(id) || id <= 0) {
    return { ok: false, error: "بيانات غير صالحة" };
  }

  try {
    await prisma.contactMessage.delete({ where: { id } });
    revalidatePath("/admin/contact-messages");
    return { ok: true };
  } catch (error) {
    console.error("[contact-messages] فشل حذف الرسالة", error);
    return { ok: false, error: "فشل حذف الرسالة" };
  }
}
