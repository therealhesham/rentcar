"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdminForAction } from "@/lib/admin-access";
import {
  SITE_KEY_BOOKING_OTP_CHANNEL,
  parseBookingOtpChannel,
  type BookingOtpChannel,
} from "@/lib/site-settings";
import { isBookingOtpSmsUrlConfigured } from "@/lib/booking-checkout-otp";
import { isOutgoingMailTransportConfigured } from "@/lib/booking-invoice-email";
import { isEvolutionWhatsAppConfigured } from "@/lib/evolution-whatsapp";
import { prisma } from "@/lib/prisma";

function validateChannelForServer(channel: BookingOtpChannel): { ok: true } | { ok: false; error: string } {
  if (channel === "SMS" && !isBookingOtpSmsUrlConfigured()) {
    return {
      ok: false,
      error:
        "لإرسال الرمز عبر الرسائل النصية يجب ضبط المتغير BOOKING_OTP_SMS_URL في بيئة الخادم (رابط GET لبوابة الإرسال).",
    };
  }
  if (channel === "EMAIL" && !isOutgoingMailTransportConfigured()) {
    return {
      ok: false,
      error:
        "لإرسال الرمز عبر البريد يجب ضبط SMTP (MAIL_HOST و MAIL_USER و MAIL_PASS) أو Resend (RESEND_API_KEY) في بيئة الخادم.",
    };
  }
  if (channel === "WHATSAPP" && !isEvolutionWhatsAppConfigured()) {
    return {
      ok: false,
      error:
        "لإرسال الرمز عبر واتساب يجب ضبط Evolution API في البيئة: EVOLUTION_API_BASE_URL و EVOLUTION_API_KEY و EVOLUTION_INSTANCE_NAME.",
    };
  }
  return { ok: true };
}

export async function updateBookingOtpDelivery(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const raw = String(formData.get("channel") ?? "").trim().toUpperCase();
  const channel = parseBookingOtpChannel(raw);

  const v = validateChannelForServer(channel);
  if (!v.ok) {
    return { ok: false, error: v.error };
  }

  try {
    await prisma.siteSetting.upsert({
      where: { key: SITE_KEY_BOOKING_OTP_CHANNEL },
      create: { key: SITE_KEY_BOOKING_OTP_CHANNEL, value: channel },
      update: { value: channel },
    });
  } catch {
    return { ok: false, error: "تعذّر حفظ الإعداد." };
  }

  revalidatePath("/fleet/checkout");
  revalidatePath("/fleet");
  revalidatePath("/account");
  revalidatePath("/admin/booking-otp-delivery");
  return { ok: true };
}
