"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import {
  isOutgoingMailTransportConfigured,
  sendPlainTransactionalEmail,
} from "@/lib/booking-invoice-email";
import { CONTACT_MESSAGES_EMAILS_KEY } from "@/lib/contact-messages";

export type ContactMessageActionState = { ok: boolean; error?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeSpaces(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

/** يمنع حقن HTML في إيميل الإشعار — القيم كلها آتية من مدخلات زائر مجهول. */
function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

type ContactMessages = {
  nameInvalid: string;
  emailInvalid: string;
  phoneInvalid: string;
  subjectInvalid: string;
  messageTooShort: string;
  messageTooLong: string;
  failed: string;
};

const MESSAGES: Record<"ar" | "en", ContactMessages> = {
  ar: {
    nameInvalid: "أدخل اسمك (حرفان على الأقل).",
    emailInvalid: "البريد الإلكتروني غير صالح.",
    phoneInvalid: "أدخل رقم جوال صالح.",
    subjectInvalid: "أدخل موضوع الرسالة.",
    messageTooShort: "اكتب رسالتك (10 أحرف على الأقل).",
    messageTooLong: "الرسالة طويلة جداً.",
    failed: "تعذّر إرسال الرسالة الآن، حاول مرة أخرى.",
  },
  en: {
    nameInvalid: "Enter your name (at least 2 characters).",
    emailInvalid: "The email address is invalid.",
    phoneInvalid: "Enter a valid mobile number.",
    subjectInvalid: "Enter a subject for your message.",
    messageTooShort: "Write your message (at least 10 characters).",
    messageTooLong: "The message is too long.",
    failed: "Could not send your message right now, please try again.",
  },
};

export async function submitContactMessage(
  _prev: ContactMessageActionState | null,
  formData: FormData,
): Promise<ContactMessageActionState> {
  const localeRaw = String(formData.get("locale") ?? "ar").trim().toLowerCase();
  const locale: "ar" | "en" = localeRaw === "en" ? "en" : "ar";
  const m = MESSAGES[locale];

  const name = normalizeSpaces(String(formData.get("name") ?? ""));
  const email = normalizeSpaces(String(formData.get("email") ?? "")).toLowerCase();
  const phone = normalizeSpaces(String(formData.get("phone") ?? ""));
  const subject = normalizeSpaces(String(formData.get("subject") ?? ""));
  const message = String(formData.get("message") ?? "").trim();
  // حقل مخفي عن المستخدم — لو اتملى فده بوت، نرد بنجاح صامت من غير تخزين.
  const honeypot = String(formData.get("company") ?? "").trim();

  if (name.length < 2 || name.length > 255) {
    return { ok: false, error: m.nameInvalid };
  }
  if (!EMAIL_RE.test(email) || email.length > 255) {
    return { ok: false, error: m.emailInvalid };
  }
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 9 || phone.length > 32) {
    return { ok: false, error: m.phoneInvalid };
  }
  if (subject.length < 2 || subject.length > 255) {
    return { ok: false, error: m.subjectInvalid };
  }
  if (message.length < 10) {
    return { ok: false, error: m.messageTooShort };
  }
  if (message.length > 8000) {
    return { ok: false, error: m.messageTooLong };
  }

  if (honeypot) {
    return { ok: true };
  }

  try {
    await prisma.contactMessage.create({
      data: { name, email, phone, subject, message, locale },
    });

    if (isOutgoingMailTransportConfigured()) {
      const setting = await prisma.siteSetting.findUnique({
        where: { key: CONTACT_MESSAGES_EMAILS_KEY },
      });
      const recipients = (setting?.value ?? "")
        .split(",")
        .map((e) => e.trim())
        .filter(Boolean);

      if (recipients.length > 0) {
        const mailSubject = `رسالة تواصل جديدة: ${subject}`;
        const html = `
          <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.6;">
            <h2 style="color: #003749;">رسالة جديدة من نموذج «تواصل معنا»</h2>
            <p><strong>الاسم:</strong> ${escapeHtml(name)}</p>
            <p><strong>البريد الإلكتروني:</strong> <a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></p>
            <p><strong>رقم الجوال:</strong> <a href="tel:${escapeHtml(phone.replace(/\s/g, ""))}" dir="ltr">${escapeHtml(phone)}</a></p>
            <p><strong>الموضوع:</strong> ${escapeHtml(subject)}</p>
            <h3 style="margin-top: 20px; color: #003749;">نص الرسالة:</h3>
            <p style="background: #f3f4f6; padding: 15px; border-radius: 8px;">${escapeHtml(message).replace(/\n/g, "<br>")}</p>
            <br>
            <p>يمكنك مراجعة الرسائل من لوحة التحكم &gt; رسائل تواصل معنا.</p>
          </div>
        `;

        for (const to of recipients) {
          try {
            await sendPlainTransactionalEmail({ to, subject: mailSubject, html });
          } catch (mailErr) {
            console.error(`[contact] فشل إرسال الإشعار إلى ${to}`, mailErr);
          }
        }
      }
    }
  } catch (e) {
    console.error("[contact] فشل حفظ رسالة التواصل", e);
    return { ok: false, error: m.failed };
  }

  revalidatePath("/admin/contact-messages");
  return { ok: true };
}
