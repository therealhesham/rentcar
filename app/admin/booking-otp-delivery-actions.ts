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
  SITE_KEY_RASAYILY_OTP_CONFIG,
  getRasayilyOtpConfig,
  isRasayilyConfigured,
  normalizeRasayilyOtpConfig,
  whatsappProviderForFlow,
  type RasayilyOtpConfig,
  type WhatsappOtpFlow,
} from "@/lib/rasayily-whatsapp";
import { prisma } from "@/lib/prisma";

function validateFlow(
  flow: WhatsappOtpFlow,
  channel: BookingOtpChannel,
  cfg: RasayilyOtpConfig,
): string | null {
  const label = flow === "login" ? "تسجيل الدخول" : "تأكيد الحجز";
  if (channel === "SMS" && !isSmsChannelConfigured()) {
    return `${label}: لإرسال الرمز عبر الرسائل النصية يجب ضبط MSEGAT_USERNAME و MSEGAT_API_KEY و MSEGAT_SENDER في بيئة الخادم.`;
  }
  if (channel === "EMAIL" && !isOutgoingMailTransportConfigured()) {
    return `${label}: لإرسال الرمز عبر البريد يجب ضبط SMTP (MAIL_HOST و MAIL_USER و MAIL_PASS) أو Resend (RESEND_API_KEY) في بيئة الخادم.`;
  }
  if (channel === "WHATSAPP") {
    if (whatsappProviderForFlow(cfg, flow) === "rasayily") {
      if (!isRasayilyConfigured(cfg)) {
        return `${label}: أدخل Company ID و API Token لاستخدام رسائلي.`;
      }
    } else if (!isEvolutionWhatsAppConfigured()) {
      return `${label}: Evolution غير مضبوط في البيئة (EVOLUTION_API_BASE_URL و EVOLUTION_API_KEY و EVOLUTION_INSTANCE_NAME). اختر رسائلي أو اضبط Evolution.`;
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

  const current = await getRasayilyOtpConfig();
  // الحقل السري لا يُعاد إرساله للمتصفح — تركه فارغاً يعني الإبقاء على القيمة المحفوظة.
  const newToken = text("apiToken").trim();
  const cfg = normalizeRasayilyOtpConfig({
    apiToken: newToken || current.apiToken,
    companyId: text("companyId"),
    loginProvider: text("loginProvider"),
    checkoutProvider: text("checkoutProvider"),
  } satisfies Record<keyof RasayilyOtpConfig, string>);

  const error =
    validateFlow("login", loginChannel, cfg) ?? validateFlow("checkout", checkoutChannel, cfg);
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
        where: { key: SITE_KEY_RASAYILY_OTP_CONFIG },
        create: { key: SITE_KEY_RASAYILY_OTP_CONFIG, value: JSON.stringify(cfg) },
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
