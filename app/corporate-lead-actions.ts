"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

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
    await prisma.corporateBookingLead.create({
      data: {
        companyName,
        companyEmail,
        taxNumber,
        details,
        phone,
      },
    });
  } catch (e) {
    console.error(e);
    return { ok: false, error: "تعذّر إرسال الطلب الآن، حاول مرة أخرى." };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/corporate-leads");
  return { ok: true };
}
