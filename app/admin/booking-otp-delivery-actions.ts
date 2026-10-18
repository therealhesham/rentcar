"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdminForAction } from "@/lib/admin-access";
import {
  SITE_KEY_BOOKING_OTP_CHANNEL,
  SITE_KEY_LOGIN_OTP_CHANNEL,
  parseBookingOtpChannel,
  type BookingOtpChannel,
} from "@/lib/site-settings";
import { isSmsChannelConfigured } from "@/lib/booking-checkout-otp";
import { isOutgoingMailTransportConfigured } from "@/lib/booking-invoice-email";
import { isEvolutionWhatsAppConfigured } from "@/lib/evolution-whatsapp";
import {
  SITE_KEY_WHATSAPP_OTP_CONFIG,
  getWhatsappOtpConfig,
  isMetaConfiguredForFlow,
  isRasayilyConfigured,
  normalizeWhatsappOtpConfig,
  whatsappProviderForFlow,
  type WhatsappOtpConfig,
  type WhatsappMessageFlow,
} from "@/lib/whatsapp-otp";
import { prisma } from "@/lib/prisma";

function validateFlow(
  flow: WhatsappMessageFlow,
  channel: BookingOtpChannel,
  cfg: WhatsappOtpConfig,
): string | null {
  const label =
    flow === "login"
      ? "تسجيل الدخول"
      : flow === "checkout"
        ? "رمز تأكيد الحجز"
        : flow === "bookingCompletion"
          ? "رسالة تأكيد الحجز بعد الدفع"
          : flow === "bookingConfirmed"
            ? "إشعار تأكيد الحجز المبدئي"
            : "إشعار حجز مدفوع/مؤكد (الإدارة)";
  if (channel === "SMS" && !isSmsChannelConfigured()) {
    return `${label}: لإرسال الرمز عبر الرسائل النصية يجب ضبط MSEGAT_USERNAME و MSEGAT_API_KEY و MSEGAT_SENDER في بيئة الخادم.`;
  }
  if (channel === "EMAIL" && !isOutgoingMailTransportConfigured()) {
    return `${label}: لإرسال الرمز عبر البريد يجب ضبط SMTP (MAIL_HOST و MAIL_USER و MAIL_PASS) أو Resend (RESEND_API_KEY) في بيئة الخادم.`;
  }
  if (channel === "WHATSAPP") {
    const provider = whatsappProviderForFlow(cfg, flow);
    if (provider === "none") {
      // تعطيل عمدي — لا تحقّق مطلوب.
    } else if (provider === "meta") {
      if (!cfg.phoneNumberId || !cfg.accessToken) {
        return `${label}: أدخل Phone Number ID و Access Token لاستخدام Meta.`;
      }
      if (!isMetaConfiguredForFlow(cfg, flow)) {
        return `${label}: أدخل اسم قالب Meta.`;
      }
    } else if (provider === "rasayily") {
      if (!isRasayilyConfigured(cfg)) {
        return `${label}: أدخل Company ID و API Token لاستخدام رسائلي.`;
      }
    } else if (!isEvolutionWhatsAppConfigured()) {
      return `${label}: Evolution غير مضبوط في البيئة (EVOLUTION_API_BASE_URL و EVOLUTION_API_KEY و EVOLUTION_INSTANCE_NAME). اختر مزوّداً آخر أو اضبط Evolution.`;
    }
  }
  return null;
}

/** يحفظ قناة ومزوّد كل من تسجيل الدخول وتأكيد الحجز دفعة واحدة. */
export async function updateOtpDeliverySettings(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const text = (name: string) => String(formData.get(name) ?? "");
  const loginChannel = parseBookingOtpChannel(text("loginChannel").trim().toUpperCase());
  const checkoutChannel = parseBookingOtpChannel(text("checkoutChannel").trim().toUpperCase());

  const current = await getWhatsappOtpConfig();
  // الحقول السرية لا تُعاد للمتصفح — تركها فارغة يعني الإبقاء على القيمة المحفوظة.
  const cfg = normalizeWhatsappOtpConfig({
    loginProvider: text("loginProvider"),
    loginTemplateName: text("loginTemplateName"),
    loginTemplateLang: text("loginTemplateLang"),
    checkoutProvider: text("checkoutProvider"),
    checkoutTemplateName: text("checkoutTemplateName"),
    checkoutTemplateLang: text("checkoutTemplateLang"),
    bookingCompletionProvider: text("bookingCompletionProvider"),
    bookingCompletionTemplateName: text("bookingCompletionTemplateName"),
    bookingCompletionTemplateLang: text("bookingCompletionTemplateLang"),
    bookingConfirmedProvider: text("bookingConfirmedProvider"),
    bookingConfirmedTemplateName: text("bookingConfirmedTemplateName"),
    bookingConfirmedTemplateLang: text("bookingConfirmedTemplateLang"),
    bookingCompletionAdminProvider: text("bookingCompletionAdminProvider"),
    bookingCompletionAdminTemplateName: text("bookingCompletionAdminTemplateName"),
    bookingCompletionAdminTemplateLang: text("bookingCompletionAdminTemplateLang"),
    phoneNumberId: text("phoneNumberId"),
    accessToken: text("accessToken").trim() || current.accessToken,
    apiVersion: text("apiVersion"),
    rasayilyToken: text("rasayilyToken").trim() || current.rasayilyToken,
    rasayilyCompanyId: text("rasayilyCompanyId"),
  } satisfies Record<keyof WhatsappOtpConfig, string>);

  const error =
    validateFlow("login", loginChannel, cfg) ??
    validateFlow("checkout", checkoutChannel, cfg) ??
    validateFlow("bookingCompletion", "WHATSAPP", cfg) ??
    validateFlow("bookingConfirmed", "WHATSAPP", cfg) ??
    validateFlow("bookingCompletionAdmin", "WHATSAPP", cfg);
  if (error) return { ok: false, error };

  try {
    await prisma.$transaction([
      prisma.siteSetting.upsert({
        where: { key: SITE_KEY_LOGIN_OTP_CHANNEL },
        create: { key: SITE_KEY_LOGIN_OTP_CHANNEL, value: loginChannel },
        update: { value: loginChannel },
      }),
      prisma.siteSetting.upsert({
        where: { key: SITE_KEY_BOOKING_OTP_CHANNEL },
        create: { key: SITE_KEY_BOOKING_OTP_CHANNEL, value: checkoutChannel },
        update: { value: checkoutChannel },
      }),
      prisma.siteSetting.upsert({
        where: { key: SITE_KEY_WHATSAPP_OTP_CONFIG },
        create: { key: SITE_KEY_WHATSAPP_OTP_CONFIG, value: JSON.stringify(cfg) },
        update: { value: JSON.stringify(cfg) },
      }),
    ]);
  } catch {
    return { ok: false, error: "تعذّر حفظ الإعدادات." };
  }

  revalidatePath("/fleet/checkout");
  revalidatePath("/fleet");
  revalidatePath("/account");
  revalidatePath("/admin/booking-otp-delivery");
  return { ok: true };
}
