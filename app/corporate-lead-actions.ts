"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { isOutgoingMailTransportConfigured, sendPlainTransactionalEmail } from "@/lib/booking-invoice-email";

export type CorporateLeadActionState = { ok: boolean; error?: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function normalizeSpaces(s: string): string {
  return s.trim().replace(/\s+/g, " ");
}

export async function submitCorporateBookingLead(
  _prev: CorporateLeadActionState | null,
  formData: FormData,
): Promise<CorporateLeadActionState> {
  const companyName = normalizeSpaces(String(formData.get("companyName") ?? ""));
  const companyEmail = normalizeSpaces(String(formData.get("companyEmail") ?? "")).toLowerCase();
  const taxNumber = normalizeSpaces(String(formData.get("taxNumber") ?? ""));
  const details = String(formData.get("details") ?? "").trim();
  const phone = normalizeSpaces(String(formData.get("phone") ?? ""));

  if (companyName.length < 2 || companyName.length > 255) {
    return { ok: false, error: "أدخل اسم الشركة (حرفان على الأقل)." };
  }
  if (!EMAIL_RE.test(companyEmail) || companyEmail.length > 255) {
    return { ok: false, error: "البريد الإلكتروني للشركة غير صالح." };
  }
  if (taxNumber.length < 1 || taxNumber.length > 64) {
    return { ok: false, error: "أدخل الرقم الضريبي." };
  }
  if (details.length < 10) {
    return { ok: false, error: "اكتب تفاصيل الطلب (10 أحرف على الأقل)." };
  }
  if (details.length > 8000) {
    return { ok: false, error: "تفاصيل الطلب طويلة جداً." };
  }
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 9 || phone.length > 32) {
    return { ok: false, error: "أدخل رقم جوال صالح." };
  }

  try {
    const lead = await prisma.corporateBookingLead.create({
      data: {
        companyName,
        companyEmail,
        taxNumber,
        details,
        phone,
      },
    });

    if (isOutgoingMailTransportConfigured()) {
      const setting = await prisma.siteSetting.findUnique({
        where: { key: "corporate_leads_emails" }
      });
      
      if (setting && setting.value) {
        const emails = setting.value.split(",").map(e => e.trim()).filter(Boolean);
        if (emails.length > 0) {
          const subject = `طلب حجز شركات جديد من ${companyName}`;
          const html = `
            <div dir="rtl" style="font-family: Arial, sans-serif; line-height: 1.6;">
              <h2 style="color: #003749;">طلب حجز شركات جديد</h2>
              <p><strong>اسم الشركة:</strong> ${companyName}</p>
              <p><strong>البريد الإلكتروني:</strong> <a href="mailto:${companyEmail}">${companyEmail}</a></p>
              <p><strong>رقم الجوال:</strong> <a href="tel:${phone}" dir="ltr">${phone}</a></p>
              <p><strong>الرقم الضريبي:</strong> ${taxNumber}</p>
              <h3 style="margin-top: 20px; color: #003749;">تفاصيل الطلب:</h3>
              <p style="background: #f3f4f6; padding: 15px; border-radius: 8px;">${details.replace(/\n/g, "<br>")}</p>
              <br>
              <p>يمكنك مراجعة الطلب من خلال لوحة تحكم روائس.</p>
            </div>
          `;
          
          for (const email of emails) {
            try {
              await sendPlainTransactionalEmail({
                to: email,
                subject,
                html
              });
            } catch (mailErr) {
              console.error(`Failed to send email to ${email}`, mailErr);
            }
          }
        }
      }
    }
  } catch (e) {
    console.error(e);
    return { ok: false, error: "تعذّر إرسال الطلب الآن، حاول مرة أخرى." };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/corporate-leads");
  return { ok: true };
}
