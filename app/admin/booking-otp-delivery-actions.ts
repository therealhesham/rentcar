"use server";

import { revalidatePath } from "next/cache";
import { requireSuperAdminForAction } from "@/lib/admin-access";
import {
  SITE_KEY_BOOKING_OTP_CHANNEL,
  getBookingOtpChannel,
  parseBookingOtpChannel,
  type BookingOtpChannel,
} from "@/lib/site-settings";
import { isSmsChannelConfigured } from "@/lib/booking-checkout-otp";
import { isOutgoingMailTransportConfigured } from "@/lib/booking-invoice-email";
import { isEvolutionWhatsAppConfigured } from "@/lib/evolution-whatsapp";
import {
  SITE_KEY_META_WHATSAPP_OTP_CONFIG,
  getMetaWhatsappOtpConfig,
  isMetaReadyForFlow,
  normalizeMetaWhatsappOtpConfig,
  type MetaWhatsappOtpConfig,
} from "@/lib/meta-whatsapp";
import { prisma } from "@/lib/prisma";

async function validateChannelForServer(
  channel: BookingOtpChannel,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (channel === "SMS" && !isSmsChannelConfigured()) {
    return {
      ok: false,
      error:
        "لإرسال الرمز عبر الرسائل النصية يجب ضبط MSEGAT_USERNAME و MSEGAT_API_KEY و MSEGAT_SENDER في بيئة الخادم.",
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
    // بدون Evolution يجب أن تغطي Meta تسجيل الدخول وتأكيد الحجز معاً.
    const meta = await getMetaWhatsappOtpConfig();
    if (!isMetaReadyForFlow(meta, "login") || !isMetaReadyForFlow(meta, "checkout")) {
      return {
        ok: false,
        error:
          "لإرسال الرمز عبر واتساب: إمّا اضبط Evolution API في البيئة (EVOLUTION_API_BASE_URL و EVOLUTION_API_KEY و EVOLUTION_INSTANCE_NAME)، أو فعّل Meta واكتمل إعدادها لتسجيل الدخول وتأكيد الحجز معاً.",
      };
    }
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

  const v = await validateChannelForServer(channel);
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

export async function updateMetaWhatsappOtpConfig(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const current = await getMetaWhatsappOtpConfig();
  const checked = (name: string) => formData.get(name) === "on";
  const text = (name: string) => String(formData.get(name) ?? "");
  // الحقل السري لا يُعاد إرساله للمتصفح — الترك فارغاً يعني الإبقاء على القيمة المحفوظة.
  const newToken = text("accessToken").trim();

  const raw: MetaWhatsappOtpConfig = {
    enabled: checked("enabled"),
    loginEnabled: checked("loginEnabled"),
    checkoutEnabled: checked("checkoutEnabled"),
    phoneNumberId: text("phoneNumberId"),
    accessToken: newToken || current.accessToken,
    apiVersion: text("apiVersion"),
    loginTemplateName: text("loginTemplateName"),
    loginTemplateLang: text("loginTemplateLang"),
    checkoutTemplateName: text("checkoutTemplateName"),
    checkoutTemplateLang: text("checkoutTemplateLang"),
    loginHasCopyButton: checked("loginHasCopyButton"),
    checkoutHasCopyButton: checked("checkoutHasCopyButton"),
  };
  const config = normalizeMetaWhatsappOtpConfig(raw);

  if (config.enabled) {
    if (!config.phoneNumberId || !config.accessToken) {
      return { ok: false, error: "أدخل Phone Number ID و Access Token قبل تفعيل Meta." };
    }
    if (!config.loginEnabled && !config.checkoutEnabled) {
      return { ok: false, error: "اختر تسجيل الدخول أو تأكيد الحجز (أو الاثنين) عند تفعيل Meta." };
    }
    if (config.loginEnabled && !config.loginTemplateName) {
      return { ok: false, error: "أدخل اسم قالب تسجيل الدخول." };
    }
    if (config.checkoutEnabled && !config.checkoutTemplateName) {
      return { ok: false, error: "أدخل اسم قالب تأكيد الحجز." };
    }
  }

  // لو القناة الحالية واتساب وسيتوقف مسار بدون بديل Evolution → نمنع الحفظ بدل كسر الإرسال.
  const channel = await getBookingOtpChannel();
  if (channel === "WHATSAPP" && !isEvolutionWhatsAppConfigured()) {
    if (!isMetaReadyForFlow(config, "login") || !isMetaReadyForFlow(config, "checkout")) {
      return {
        ok: false,
        error:
          "القناة الحالية واتساب وEvolution غير مضبوط في البيئة، فلازم تبقى Meta مفعّلة لتسجيل الدخول وتأكيد الحجز معاً.",
      };
    }
  }

  try {
    await prisma.siteSetting.upsert({
      where: { key: SITE_KEY_META_WHATSAPP_OTP_CONFIG },
      create: { key: SITE_KEY_META_WHATSAPP_OTP_CONFIG, value: JSON.stringify(config) },
      update: { value: JSON.stringify(config) },
    });
  } catch {
    return { ok: false, error: "تعذّر حفظ إعدادات Meta." };
  }

  revalidatePath("/fleet/checkout");
  revalidatePath("/account");
  revalidatePath("/admin/booking-otp-delivery");
  return { ok: true };
}
