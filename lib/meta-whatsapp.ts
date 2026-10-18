import {
  e164ToEvolutionWhatsAppNumber,
  isEvolutionWhatsAppConfigured,
  sendEvolutionWhatsAppText,
} from "@/lib/evolution-whatsapp";
import { prisma } from "@/lib/prisma";

/**
 * إرسال رمز التحقق عبر WhatsApp Cloud API الرسمي (Meta) باستخدام قالب معتمد.
 *
 * الإعدادات تُخزَّن في SiteSetting بمفتاح `meta_whatsapp_otp_config_v1` كـ JSON —
 * لا حاجة لأي عمود أو ترحيل جديد، ولا لمتغيرات بيئة.
 *
 * المسار الفعلي لكل تدفّق (تسجيل الدخول / تأكيد الحجز):
 * - Meta مفعّلة + التدفّق مُعلَّم + الحقول مكتملة → Meta.
 * - غير ذلك → Evolution كما كان (ولا يتغيّر سلوكه).
 */

export const SITE_KEY_META_WHATSAPP_OTP_CONFIG = "meta_whatsapp_otp_config_v1";

export type WhatsappOtpFlow = "login" | "checkout";

export type MetaWhatsappOtpConfig = {
  /** المفتاح الرئيسي لتفعيل Meta. */
  enabled: boolean;
  /** استخدام Meta لرمز تسجيل الدخول. */
  loginEnabled: boolean;
  /** استخدام Meta لرمز تأكيد الحجز. */
  checkoutEnabled: boolean;
  phoneNumberId: string;
  accessToken: string;
  apiVersion: string;
  loginTemplateName: string;
  loginTemplateLang: string;
  checkoutTemplateName: string;
  checkoutTemplateLang: string;
  /** قوالب Authentication تتطلب مكوّن زر (نسخ الرمز) يحمل نفس الرمز — لكل قالب على حدة. */
  loginHasCopyButton: boolean;
  checkoutHasCopyButton: boolean;
};

export const DEFAULT_META_WHATSAPP_OTP_CONFIG: MetaWhatsappOtpConfig = {
  enabled: false,
  loginEnabled: false,
  checkoutEnabled: false,
  phoneNumberId: "",
  accessToken: "",
  apiVersion: "v21.0",
  loginTemplateName: "",
  loginTemplateLang: "ar",
  checkoutTemplateName: "",
  checkoutTemplateLang: "ar",
  loginHasCopyButton: true,
  checkoutHasCopyButton: true,
};

function asBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return fallback;
}

function asString(v: unknown, fallback: string): string {
  return typeof v === "string" ? v.trim() : fallback;
}

export function normalizeMetaWhatsappOtpConfig(raw: unknown): MetaWhatsappOtpConfig {
  const o =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const d = DEFAULT_META_WHATSAPP_OTP_CONFIG;
  return {
    enabled: asBool(o.enabled, d.enabled),
    loginEnabled: asBool(o.loginEnabled, d.loginEnabled),
    checkoutEnabled: asBool(o.checkoutEnabled, d.checkoutEnabled),
    phoneNumberId: asString(o.phoneNumberId, d.phoneNumberId),
    accessToken: asString(o.accessToken, d.accessToken),
    apiVersion: asString(o.apiVersion, d.apiVersion) || d.apiVersion,
    loginTemplateName: asString(o.loginTemplateName, d.loginTemplateName),
    loginTemplateLang: asString(o.loginTemplateLang, d.loginTemplateLang) || d.loginTemplateLang,
    checkoutTemplateName: asString(o.checkoutTemplateName, d.checkoutTemplateName),
    checkoutTemplateLang:
      asString(o.checkoutTemplateLang, d.checkoutTemplateLang) || d.checkoutTemplateLang,
    loginHasCopyButton: asBool(o.loginHasCopyButton, d.loginHasCopyButton),
    checkoutHasCopyButton: asBool(o.checkoutHasCopyButton, d.checkoutHasCopyButton),
  };
}

export async function getMetaWhatsappOtpConfig(): Promise<MetaWhatsappOtpConfig> {
  try {
    const row = await prisma.siteSetting.findUnique({
      where: { key: SITE_KEY_META_WHATSAPP_OTP_CONFIG },
      select: { value: true },
    });
    if (!row?.value?.trim()) return DEFAULT_META_WHATSAPP_OTP_CONFIG;
    return normalizeMetaWhatsappOtpConfig(JSON.parse(row.value) as unknown);
  } catch (e) {
    console.error("[getMetaWhatsappOtpConfig] قراءة الإعداد فشلت:", e);
    return DEFAULT_META_WHATSAPP_OTP_CONFIG;
  }
}

/** هل Meta جاهزة فعلاً لهذا التدفّق (مفعّلة + مُعلَّم + بيانات الاتصال والقالب مكتملة)؟ */
export function isMetaReadyForFlow(cfg: MetaWhatsappOtpConfig, flow: WhatsappOtpFlow): boolean {
  if (!cfg.enabled || !cfg.phoneNumberId || !cfg.accessToken) return false;
  if (flow === "login") return cfg.loginEnabled && Boolean(cfg.loginTemplateName);
  return cfg.checkoutEnabled && Boolean(cfg.checkoutTemplateName);
}

/** هل يوجد مزوّد واتساب صالح (Meta أو Evolution) لإرسال رمز هذا التدفّق؟ */
export async function isWhatsappOtpDeliverable(flow: WhatsappOtpFlow): Promise<boolean> {
  const cfg = await getMetaWhatsappOtpConfig();
  return isMetaReadyForFlow(cfg, flow) || isEvolutionWhatsAppConfigured();
}

async function postMetaTemplate(opts: {
  cfg: MetaWhatsappOtpConfig;
  to: string;
  templateName: string;
  languageCode: string;
  hasCopyButton: boolean;
  code: string;
}): Promise<void> {
  const { cfg } = opts;
  const url = `https://graph.facebook.com/${encodeURIComponent(cfg.apiVersion)}/${encodeURIComponent(
    cfg.phoneNumberId,
  )}/messages`;

  const components: unknown[] = [
    { type: "body", parameters: [{ type: "text", text: opts.code }] },
  ];
  if (opts.hasCopyButton) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: opts.code }],
    });
  }

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${cfg.accessToken}`,
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to: opts.to,
      type: "template",
      template: {
        name: opts.templateName,
        language: { code: opts.languageCode },
        components,
      },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Meta HTTP ${res.status}: ${errBody.slice(0, 500)}`);
  }
}

/**
 * يرسل رمز OTP عبر المزوّد المناسب للتدفّق. يرمي خطأً عند الفشل.
 * `evolutionText` هو نص الرسالة الحرّ المستخدم فقط إذا كان المسار Evolution.
 */
export async function sendWhatsappOtp(opts: {
  flow: WhatsappOtpFlow;
  phoneE164: string;
  otp: string;
  evolutionText: string;
}): Promise<void> {
  const number = e164ToEvolutionWhatsAppNumber(opts.phoneE164);
  if (!number) throw new Error("رقم الجوال غير صالح لإرسال واتساب.");

  const cfg = await getMetaWhatsappOtpConfig();
  if (isMetaReadyForFlow(cfg, opts.flow)) {
    const isLogin = opts.flow === "login";
    await postMetaTemplate({
      cfg,
      to: number,
      templateName: isLogin ? cfg.loginTemplateName : cfg.checkoutTemplateName,
      languageCode: isLogin ? cfg.loginTemplateLang : cfg.checkoutTemplateLang,
      hasCopyButton: isLogin ? cfg.loginHasCopyButton : cfg.checkoutHasCopyButton,
      code: opts.otp,
    });
    return;
  }

  await sendEvolutionWhatsAppText({ number, text: opts.evolutionText });
}
