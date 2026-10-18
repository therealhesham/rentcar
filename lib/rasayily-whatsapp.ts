import {
  e164ToEvolutionWhatsAppNumber,
  isEvolutionWhatsAppConfigured,
  sendEvolutionWhatsAppText,
} from "@/lib/evolution-whatsapp";
import { prisma } from "@/lib/prisma";

/**
 * إرسال رمز التحقق (تسجيل الدخول / تأكيد الحجز) عبر منصة رسائلي (rasayily.com)
 * أو عبر Evolution — يُختار المزوّد لكل تدفّق على حدة من لوحة الإدارة.
 *
 * رسائلي: POST https://rasayily.com/api/messages/send
 *   Authorization: Bearer {token} + X-Company-ID
 *   body: { phone_number, message, type: "text", channel: "whatsapp" }
 * الطلب يُعالَج في طابور عندهم، فالنجاح يعني القبول وليس تأكيد التسليم.
 * نص الرسالة هو نفس قالب الواتساب المحفوظ في الإدارة (يحتوي {otp}).
 *
 * الإعدادات في SiteSetting بمفتاح `rasayily_otp_config_v1` كـ JSON —
 * لا ترحيل ولا متغيرات بيئة.
 */

/** الرابط ثابت — الإعداد المطلوب Company ID و Token فقط. */
const RASAYILY_BASE_URL = "https://rasayily.com";

export const SITE_KEY_RASAYILY_OTP_CONFIG = "rasayily_otp_config_v1";

export type WhatsappOtpFlow = "login" | "checkout";
export type WhatsappProvider = "evolution" | "rasayily";

export type RasayilyOtpConfig = {
  apiToken: string;
  companyId: string;
  /** مزوّد واتساب لرمز تسجيل الدخول (يُستخدم عندما تكون قناته «واتساب»). */
  loginProvider: WhatsappProvider;
  /** مزوّد واتساب لرمز تأكيد الحجز. */
  checkoutProvider: WhatsappProvider;
};

export const DEFAULT_RASAYILY_OTP_CONFIG: RasayilyOtpConfig = {
  apiToken: "",
  companyId: "",
  loginProvider: "evolution",
  checkoutProvider: "evolution",
};

function asString(v: unknown, fallback: string): string {
  return typeof v === "string" ? v.trim() : fallback;
}

function asProvider(v: unknown): WhatsappProvider {
  return v === "rasayily" ? "rasayily" : "evolution";
}

export function normalizeRasayilyOtpConfig(raw: unknown): RasayilyOtpConfig {
  const o =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const d = DEFAULT_RASAYILY_OTP_CONFIG;
  return {
    apiToken: asString(o.apiToken, d.apiToken),
    companyId: asString(o.companyId, d.companyId),
    loginProvider: asProvider(o.loginProvider),
    checkoutProvider: asProvider(o.checkoutProvider),
  };
}

export async function getRasayilyOtpConfig(): Promise<RasayilyOtpConfig> {
  try {
    const row = await prisma.siteSetting.findUnique({
      where: { key: SITE_KEY_RASAYILY_OTP_CONFIG },
      select: { value: true },
    });
    if (!row?.value?.trim()) return DEFAULT_RASAYILY_OTP_CONFIG;
    return normalizeRasayilyOtpConfig(JSON.parse(row.value) as unknown);
  } catch (e) {
    console.error("[getRasayilyOtpConfig] قراءة الإعداد فشلت:", e);
    return DEFAULT_RASAYILY_OTP_CONFIG;
  }
}

export function whatsappProviderForFlow(
  cfg: RasayilyOtpConfig,
  flow: WhatsappOtpFlow,
): WhatsappProvider {
  return flow === "login" ? cfg.loginProvider : cfg.checkoutProvider;
}

/** هل بيانات الاتصال برسائلي مكتملة؟ */
export function isRasayilyConfigured(cfg: RasayilyOtpConfig): boolean {
  return Boolean(cfg.apiToken && cfg.companyId);
}

/** هل المزوّد المختار لهذا التدفّق جاهز فعلاً (رسائلي أو Evolution)؟ */
export function isWhatsappProviderReady(cfg: RasayilyOtpConfig, flow: WhatsappOtpFlow): boolean {
  return whatsappProviderForFlow(cfg, flow) === "rasayily"
    ? isRasayilyConfigured(cfg)
    : isEvolutionWhatsAppConfigured();
}

export async function isWhatsappOtpDeliverable(flow: WhatsappOtpFlow): Promise<boolean> {
  return isWhatsappProviderReady(await getRasayilyOtpConfig(), flow);
}

async function postRasayilyText(opts: {
  cfg: RasayilyOtpConfig;
  phoneE164: string;
  text: string;
}): Promise<void> {
  const { cfg } = opts;
  const res = await fetch(`${RASAYILY_BASE_URL}/api/messages/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${cfg.apiToken}`,
      "X-Company-ID": cfg.companyId,
    },
    body: JSON.stringify({
      phone_number: opts.phoneE164,
      message: opts.text,
      type: "text",
      channel: "whatsapp",
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Rasayily HTTP ${res.status}: ${errBody.slice(0, 500)}`);
  }
}

/**
 * يرسل رمز OTP عبر مزوّد واتساب المختار للتدفّق. يرمي خطأً عند الفشل.
 * `text` هو نص الرسالة الكامل (قالب الواتساب بعد استبدال {otp}).
 */
export async function sendWhatsappOtp(opts: {
  flow: WhatsappOtpFlow;
  phoneE164: string;
  text: string;
}): Promise<void> {
  const cfg = await getRasayilyOtpConfig();
  if (whatsappProviderForFlow(cfg, opts.flow) === "rasayily") {
    if (!isRasayilyConfigured(cfg)) throw new Error("إعدادات رسائلي غير مكتملة.");
    await postRasayilyText({ cfg, phoneE164: opts.phoneE164, text: opts.text });
    return;
  }

  const number = e164ToEvolutionWhatsAppNumber(opts.phoneE164);
  if (!number) throw new Error("رقم الجوال غير صالح لإرسال واتساب.");
  await sendEvolutionWhatsAppText({ number, text: opts.text });
}
