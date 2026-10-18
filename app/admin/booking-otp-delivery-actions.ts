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
  SITE_KEY_META_WHATSAPP_OTP_CONFIG,
  getMetaWhatsappOtpConfig,
  isMetaConfiguredForFlow,
  normalizeMetaWhatsappOtpConfig,
  whatsappProviderForFlow,
  type MetaWhatsappOtpConfig,
  type WhatsappOtpFlow,
} from "@/lib/meta-whatsapp";
import { prisma } from "@/lib/prisma";

function validateFlow(
  flow: WhatsappOtpFlow,
  channel: BookingOtpChannel,
  meta: MetaWhatsappOtpConfig,
): string | null {
  const label = flow === "login" ? "تسجيل الدخول" : "تأكيد الحجز";
  if (channel === "SMS" && !isSmsChannelConfigured()) {
    return `${label}: لإرسال الرمز عبر الرسائل النصية يجب ضبط MSEGAT_USERNAME و MSEGAT_API_KEY و MSEGAT_SENDER في بيئة الخادم.`;
  }
  if (channel === "EMAIL" && !isOutgoingMailTransportConfigured()) {
    return `${label}: لإرسال الرمز عبر البريد يجب ضبط SMTP (MAIL_HOST و MAIL_USER و MAIL_PASS) أو Resend (RESEND_API_KEY) في بيئة الخادم.`;
  }
  if (channel === "WHATSAPP") {
    if (whatsappProviderForFlow(meta, flow) === "meta") {
      if (!meta.phoneNumberId || !meta.accessToken) {
        return `${label}: أدخل Phone Number ID و Access Token لاستخدام Meta.`;
      }
      if (!isMetaConfiguredForFlow(meta, flow)) {
        return `${label}: أدخل اسم قالب Meta.`;
      }
    } else if (!isEvolutionWhatsAppConfigured()) {
      return `${label}: Evolution غير مضبوط في البيئة (EVOLUTION_API_BASE_URL و EVOLUTION_API_KEY و EVOLUTION_INSTANCE_NAME). اختر Meta أو اضبط Evolution.`;
    }
  }
  return null;
}

/** يحفظ قناة ومزوّد وقالب كل من تسجيل الدخول وتأكيد الحجز دفعة واحدة. */
export async function updateOtpDeliverySettings(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireSuperAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const text = (name: string) => String(formData.get(name) ?? "");
  const loginChannel = parseBookingOtpChannel(text("loginChannel").trim().toUpperCase());
  const checkoutChannel = parseBookingOtpChannel(text("checkoutChannel").trim().toUpperCase());

  const current = await getMetaWhatsappOtpConfig();
  // الحقل السري لا يُعاد إرساله للمتصفح — تركه فارغاً يعني الإبقاء على القيمة المحفوظة.
  const newToken = text("accessToken").trim();
  const meta = normalizeMetaWhatsappOtpConfig({
    phoneNumberId: text("phoneNumberId"),
    accessToken: newToken || current.accessToken,
    apiVersion: text("apiVersion"),
    loginProvider: text("loginProvider"),
    loginTemplateName: text("loginTemplateName"),
    loginTemplateLang: text("loginTemplateLang"),
    checkoutProvider: text("checkoutProvider"),
    checkoutTemplateName: text("checkoutTemplateName"),
    checkoutTemplateLang: text("checkoutTemplateLang"),
  } satisfies Record<keyof MetaWhatsappOtpConfig, string>);

  const error =
    validateFlow("login", loginChannel, meta) ?? validateFlow("checkout", checkoutChannel, meta);
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
        where: { key: SITE_KEY_META_WHATSAPP_OTP_CONFIG },
        create: { key: SITE_KEY_META_WHATSAPP_OTP_CONFIG, value: JSON.stringify(meta) },
        update: { value: JSON.stringify(meta) },
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
