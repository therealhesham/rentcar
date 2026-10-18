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
 * لكل تدفّق (تسجيل الدخول / تأكيد الحجز) مزوّد واتساب مستقل: Evolution أو Meta،
 * ولكل منهما قالب Meta خاص به. المزوّد لا يُستخدم إلا إذا كانت قناة التدفّق «واتساب».
 */

export const SITE_KEY_META_WHATSAPP_OTP_CONFIG = "meta_whatsapp_otp_config_v1";

export type WhatsappOtpFlow = "login" | "checkout";
export type WhatsappProvider = "evolution" | "meta";

export type MetaWhatsappOtpConfig = {
  phoneNumberId: string;
  accessToken: string;
  apiVersion: string;
  /** مزوّد واتساب لرمز تسجيل الدخول (يُستخدم عندما تكون قناته «واتساب»). */
  loginProvider: WhatsappProvider;
  loginTemplateName: string;
  loginTemplateLang: string;
  /** مزوّد واتساب لرمز تأكيد الحجز. */
  checkoutProvider: WhatsappProvider;
  checkoutTemplateName: string;
  checkoutTemplateLang: string;
};

export const DEFAULT_META_WHATSAPP_OTP_CONFIG: MetaWhatsappOtpConfig = {
  phoneNumberId: "",
  accessToken: "",
  apiVersion: "v21.0",
  loginProvider: "evolution",
  loginTemplateName: "",
  loginTemplateLang: "ar",
  checkoutProvider: "evolution",
  checkoutTemplateName: "",
  checkoutTemplateLang: "ar",
};

function asBool(v: unknown): boolean {
  return v === true || v === "true" || v === "1";
}

function asString(v: unknown, fallback: string): string {
  return typeof v === "string" ? v.trim() : fallback;
}

function asProvider(v: unknown, legacyMeta: boolean): WhatsappProvider {
  if (v === "meta" || v === "evolution") return v;
  return legacyMeta ? "meta" : "evolution";
}

export function normalizeMetaWhatsappOtpConfig(raw: unknown): MetaWhatsappOtpConfig {
  const o =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const d = DEFAULT_META_WHATSAPP_OTP_CONFIG;
  // النسخة الأولى كانت تخزّن enabled/loginEnabled/checkoutEnabled — نحوّلها للمزوّد.
  const legacyOn = asBool(o.enabled);
  return {
    phoneNumberId: asString(o.phoneNumberId, d.phoneNumberId),
    accessToken: asString(o.accessToken, d.accessToken),
    apiVersion: asString(o.apiVersion, d.apiVersion) || d.apiVersion,
    loginProvider: asProvider(o.loginProvider, legacyOn && asBool(o.loginEnabled)),
    loginTemplateName: asString(o.loginTemplateName, d.loginTemplateName),
    loginTemplateLang: asString(o.loginTemplateLang, d.loginTemplateLang) || d.loginTemplateLang,
    checkoutProvider: asProvider(o.checkoutProvider, legacyOn && asBool(o.checkoutEnabled)),
    checkoutTemplateName: asString(o.checkoutTemplateName, d.checkoutTemplateName),
    checkoutTemplateLang:
      asString(o.checkoutTemplateLang, d.checkoutTemplateLang) || d.checkoutTemplateLang,
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

export function whatsappProviderForFlow(
  cfg: MetaWhatsappOtpConfig,
  flow: WhatsappOtpFlow,
): WhatsappProvider {
  return flow === "login" ? cfg.loginProvider : cfg.checkoutProvider;
}

/** هل بيانات Meta (الاتصال + قالب هذا التدفّق) مكتملة؟ */
export function isMetaConfiguredForFlow(cfg: MetaWhatsappOtpConfig, flow: WhatsappOtpFlow): boolean {
  if (!cfg.phoneNumberId || !cfg.accessToken) return false;
  return Boolean(flow === "login" ? cfg.loginTemplateName : cfg.checkoutTemplateName);
}

/** هل المزوّد المختار لهذا التدفّق جاهز فعلاً (Meta أو Evolution)؟ */
export function isWhatsappProviderReady(cfg: MetaWhatsappOtpConfig, flow: WhatsappOtpFlow): boolean {
  return whatsappProviderForFlow(cfg, flow) === "meta"
    ? isMetaConfiguredForFlow(cfg, flow)
    : isEvolutionWhatsAppConfigured();
}

export async function isWhatsappOtpDeliverable(flow: WhatsappOtpFlow): Promise<boolean> {
  return isWhatsappProviderReady(await getMetaWhatsappOtpConfig(), flow);
}

/**
 * قوالب Authentication في Meta فيها زر «نسخ الرمز» يتطلب تمرير الرمز كمعامل ثانٍ،
 * وقوالب أخرى بدون زر. لا نطلب من الأدمن تحديد ذلك: نجرّب بالزر أولاً، وإن رفضت Meta
 * عدد/شكل المعاملات (400) نعيد بدونه، ونتذكّر الصيغة الناجحة لكل قالب.
 */
const copyButtonByTemplate = new Map<string, boolean>();

/** أكواد Meta الخاصة بعدم تطابق معاملات القالب (لا يُرسَل شيء عند حدوثها). */
const PARAM_MISMATCH_CODES = new Set([132000, 132001, 132012, 131008]);

class MetaHttpError extends Error {
  constructor(
    readonly status: number,
    readonly metaCode: number | null,
    body: string,
  ) {
    super(`Meta HTTP ${status}: ${body.slice(0, 500)}`);
  }
}

async function postMetaTemplateOnce(opts: {
  cfg: MetaWhatsappOtpConfig;
  to: string;
  templateName: string;
  languageCode: string;
  code: string;
  withButton: boolean;
}): Promise<void> {
  const { cfg } = opts;
  const url = `https://graph.facebook.com/${encodeURIComponent(cfg.apiVersion)}/${encodeURIComponent(
    cfg.phoneNumberId,
  )}/messages`;

  const components: unknown[] = [
    { type: "body", parameters: [{ type: "text", text: opts.code }] },
  ];
  if (opts.withButton) {
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
    let metaCode: number | null = null;
    try {
      const c = (JSON.parse(errBody) as { error?: { code?: unknown } }).error?.code;
      if (typeof c === "number") metaCode = c;
    } catch {
      /* الجسم ليس JSON */
    }
    throw new MetaHttpError(res.status, metaCode, errBody);
  }
}

async function postMetaTemplate(opts: {
  cfg: MetaWhatsappOtpConfig;
  to: string;
  templateName: string;
  languageCode: string;
  code: string;
}): Promise<void> {
  const cacheKey = `${opts.cfg.phoneNumberId}:${opts.templateName}:${opts.languageCode}`;
  const first = copyButtonByTemplate.get(cacheKey) ?? true;
  try {
    await postMetaTemplateOnce({ ...opts, withButton: first });
    copyButtonByTemplate.set(cacheKey, first);
  } catch (e) {
    const mismatch =
      e instanceof MetaHttpError &&
      e.status === 400 &&
      e.metaCode !== null &&
      PARAM_MISMATCH_CODES.has(e.metaCode);
    if (!mismatch) throw e;
    await postMetaTemplateOnce({ ...opts, withButton: !first });
    copyButtonByTemplate.set(cacheKey, !first);
  }
}

/**
 * يرسل رمز OTP عبر مزوّد واتساب المختار للتدفّق. يرمي خطأً عند الفشل.
 * `evolutionText` هو نص الرسالة الحرّ المستخدم فقط إذا كان المزوّد Evolution.
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
  if (whatsappProviderForFlow(cfg, opts.flow) === "meta") {
    if (!isMetaConfiguredForFlow(cfg, opts.flow)) {
      throw new Error("إعدادات Meta غير مكتملة لهذا التدفّق.");
    }
    const isLogin = opts.flow === "login";
    await postMetaTemplate({
      cfg,
      to: number,
      templateName: isLogin ? cfg.loginTemplateName : cfg.checkoutTemplateName,
      languageCode: isLogin ? cfg.loginTemplateLang : cfg.checkoutTemplateLang,
      code: opts.otp,
    });
    return;
  }

  await sendEvolutionWhatsAppText({ number, text: opts.evolutionText });
}
