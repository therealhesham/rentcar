import {
  e164ToEvolutionWhatsAppNumber,
  isEvolutionWhatsAppConfigured,
  sendEvolutionWhatsAppText,
} from "@/lib/evolution-whatsapp";
import { prisma } from "@/lib/prisma";

/**
 * مزوّدو واتساب لرمز التحقق (تسجيل الدخول / تأكيد الحجز) — يُختار المزوّد لكل تدفّق
 * على حدة من لوحة الإدارة:
 *
 * - evolution: نص حر عبر Evolution (متغيرات البيئة).
 * - meta: WhatsApp Cloud API الرسمي بقالب معتمد (يعمل خارج نافذة الـ 24 ساعة).
 * - rasayily: رسائلي — نص حر فقط (POST /api/messages/send)؛ خارج نافذة الـ 24 ساعة
 *   قد لا تصل إن كان الربط خلفه Meta الرسمي.
 *
 * الإعدادات في SiteSetting بمفتاح `whatsapp_otp_config_v2` كـ JSON (بلا ترحيل DB).
 * عند غيابه نقرأ المفتاحين القديمين (`meta_whatsapp_otp_config_v1` و
 * `rasayily_otp_config_v1`) فلا تضيع بيانات محفوظة سابقاً.
 */

export const SITE_KEY_WHATSAPP_OTP_CONFIG = "whatsapp_otp_config_v2";
const LEGACY_META_KEY = "meta_whatsapp_otp_config_v1";
const LEGACY_RASAYILY_KEY = "rasayily_otp_config_v1";

const RASAYILY_BASE_URL = "https://rasayily.com";

export type WhatsappOtpFlow = "login" | "checkout";
/** تدفّقات رسائل واتساب عموماً (رموز تحقق + رسائل الحجز الجاهزة). */
export type WhatsappMessageFlow = WhatsappOtpFlow | "bookingCompletion" | "bookingConfirmed";
export type WhatsappProvider = "evolution" | "meta" | "rasayily";

export type WhatsappOtpConfig = {
  loginProvider: WhatsappProvider;
  loginTemplateName: string;
  loginTemplateLang: string;
  checkoutProvider: WhatsappProvider;
  checkoutTemplateName: string;
  checkoutTemplateLang: string;
  /** رسالة «تأكيد الحجز» الكاملة (بعد الدفع/التأكيد النقدي) — تُرسل للعميل دوماً عبر هذا المزوّد. */
  bookingCompletionProvider: WhatsappProvider;
  bookingCompletionTemplateName: string;
  bookingCompletionTemplateLang: string;
  /** إشعار «تأكيد الحجز المبدئي» — يُرسل فور تأكيد الموظف للحجز قبل الدفع (غير نقدي). */
  bookingConfirmedProvider: WhatsappProvider;
  bookingConfirmedTemplateName: string;
  bookingConfirmedTemplateLang: string;
  /** Meta Cloud API */
  phoneNumberId: string;
  accessToken: string;
  apiVersion: string;
  /** رسائلي */
  rasayilyToken: string;
  rasayilyCompanyId: string;
};

export const DEFAULT_WHATSAPP_OTP_CONFIG: WhatsappOtpConfig = {
  loginProvider: "evolution",
  loginTemplateName: "",
  loginTemplateLang: "ar",
  checkoutProvider: "evolution",
  checkoutTemplateName: "",
  checkoutTemplateLang: "ar",
  bookingCompletionProvider: "evolution",
  bookingCompletionTemplateName: "",
  bookingCompletionTemplateLang: "ar",
  bookingConfirmedProvider: "evolution",
  bookingConfirmedTemplateName: "",
  bookingConfirmedTemplateLang: "ar",
  phoneNumberId: "",
  accessToken: "",
  apiVersion: "v21.0",
  rasayilyToken: "",
  rasayilyCompanyId: "",
};

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v.trim() : fallback;
}

function asProvider(v: unknown): WhatsappProvider | null {
  return v === "meta" || v === "rasayily" || v === "evolution" ? v : null;
}

export function normalizeWhatsappOtpConfig(raw: unknown): WhatsappOtpConfig {
  const o =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};
  const d = DEFAULT_WHATSAPP_OTP_CONFIG;
  return {
    loginProvider: asProvider(o.loginProvider) ?? d.loginProvider,
    loginTemplateName: str(o.loginTemplateName),
    loginTemplateLang: str(o.loginTemplateLang) || d.loginTemplateLang,
    checkoutProvider: asProvider(o.checkoutProvider) ?? d.checkoutProvider,
    checkoutTemplateName: str(o.checkoutTemplateName),
    checkoutTemplateLang: str(o.checkoutTemplateLang) || d.checkoutTemplateLang,
    bookingCompletionProvider: asProvider(o.bookingCompletionProvider) ?? d.bookingCompletionProvider,
    bookingCompletionTemplateName: str(o.bookingCompletionTemplateName),
    bookingCompletionTemplateLang: str(o.bookingCompletionTemplateLang) || d.bookingCompletionTemplateLang,
    bookingConfirmedProvider: asProvider(o.bookingConfirmedProvider) ?? d.bookingConfirmedProvider,
    bookingConfirmedTemplateName: str(o.bookingConfirmedTemplateName),
    bookingConfirmedTemplateLang: str(o.bookingConfirmedTemplateLang) || d.bookingConfirmedTemplateLang,
    phoneNumberId: str(o.phoneNumberId),
    accessToken: str(o.accessToken),
    apiVersion: str(o.apiVersion) || d.apiVersion,
    rasayilyToken: str(o.rasayilyToken),
    rasayilyCompanyId: str(o.rasayilyCompanyId),
  };
}

function parseJson(v: string | undefined): Record<string, unknown> | null {
  if (!v?.trim()) return null;
  try {
    const p = JSON.parse(v) as unknown;
    return p && typeof p === "object" && !Array.isArray(p) ? (p as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** مزوّد Meta القديم: إما `loginProvider` صريح أو (enabled && loginEnabled). */
function legacyMetaProvider(
  meta: Record<string, unknown> | null,
  flow: "login" | "checkout",
): WhatsappProvider | null {
  if (!meta) return null;
  const explicit = asProvider(meta[`${flow}Provider`]);
  if (explicit) return explicit;
  return meta.enabled === true && meta[`${flow}Enabled`] === true ? "meta" : "evolution";
}

export async function getWhatsappOtpConfig(): Promise<WhatsappOtpConfig> {
  try {
    const rows = await prisma.siteSetting.findMany({
      where: { key: { in: [SITE_KEY_WHATSAPP_OTP_CONFIG, LEGACY_META_KEY, LEGACY_RASAYILY_KEY] } },
      select: { key: true, value: true },
    });
    const byKey = new Map(rows.map((r) => [r.key, r.value]));

    const current = parseJson(byKey.get(SITE_KEY_WHATSAPP_OTP_CONFIG));
    if (current) return normalizeWhatsappOtpConfig(current);

    const meta = parseJson(byKey.get(LEGACY_META_KEY));
    const ras = parseJson(byKey.get(LEGACY_RASAYILY_KEY));
    if (!meta && !ras) return DEFAULT_WHATSAPP_OTP_CONFIG;
    return normalizeWhatsappOtpConfig({
      ...(meta ?? {}),
      // المفتاح الأحدث حفظاً (رسائلي) يحدد المزوّدين إن وُجد.
      loginProvider: asProvider(ras?.loginProvider) ?? legacyMetaProvider(meta, "login"),
      checkoutProvider: asProvider(ras?.checkoutProvider) ?? legacyMetaProvider(meta, "checkout"),
      rasayilyToken: ras?.apiToken,
      rasayilyCompanyId: ras?.companyId,
    });
  } catch (e) {
    console.error("[getWhatsappOtpConfig] قراءة الإعداد فشلت:", e);
    return DEFAULT_WHATSAPP_OTP_CONFIG;
  }
}

export function whatsappProviderForFlow(cfg: WhatsappOtpConfig, flow: WhatsappMessageFlow): WhatsappProvider {
  if (flow === "login") return cfg.loginProvider;
  if (flow === "checkout") return cfg.checkoutProvider;
  if (flow === "bookingCompletion") return cfg.bookingCompletionProvider;
  return cfg.bookingConfirmedProvider;
}

export function isMetaConfiguredForFlow(cfg: WhatsappOtpConfig, flow: WhatsappMessageFlow): boolean {
  if (!cfg.phoneNumberId || !cfg.accessToken) return false;
  const templateName =
    flow === "login"
      ? cfg.loginTemplateName
      : flow === "checkout"
        ? cfg.checkoutTemplateName
        : flow === "bookingCompletion"
          ? cfg.bookingCompletionTemplateName
          : cfg.bookingConfirmedTemplateName;
  return Boolean(templateName);
}

export function isRasayilyConfigured(cfg: WhatsappOtpConfig): boolean {
  return Boolean(cfg.rasayilyToken && cfg.rasayilyCompanyId);
}

/** هل المزوّد المختار لهذا التدفّق جاهز فعلاً؟ */
export function isWhatsappProviderReady(cfg: WhatsappOtpConfig, flow: WhatsappMessageFlow): boolean {
  switch (whatsappProviderForFlow(cfg, flow)) {
    case "meta":
      return isMetaConfiguredForFlow(cfg, flow);
    case "rasayily":
      return isRasayilyConfigured(cfg);
    default:
      return isEvolutionWhatsAppConfigured();
  }
}

export async function isWhatsappOtpDeliverable(flow: WhatsappOtpFlow): Promise<boolean> {
  return isWhatsappProviderReady(await getWhatsappOtpConfig(), flow);
}

/* ───────────────────────────── Meta Cloud API ───────────────────────────── */

/**
 * قوالب Authentication فيها زر «نسخ الرمز» يتطلب تمرير الرمز كمعامل ثانٍ، وقوالب أخرى
 * بدون زر. لا نطلب من الأدمن تحديد ذلك: نجرّب بالزر أولاً، وإن رفضت Meta عدد/شكل
 * المعاملات (400) نعيد بدونه، ونتذكّر الصيغة الناجحة لكل قالب.
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
  cfg: WhatsappOtpConfig;
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

  const components: unknown[] = [{ type: "body", parameters: [{ type: "text", text: opts.code }] }];
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

  // قبول Meta للطلب ≠ التسليم: حالة التسليم النهائية (وأكواد الفشل مثل 131026/131042)
  // تصل لاحقاً عبر webhook أو تظهر في WhatsApp Manager. نسجّل wamid لتتبّع الرسالة.
  try {
    const j = (await res.json()) as {
      messages?: { id?: string }[];
      contacts?: { wa_id?: string }[];
    };
    console.info(
      `[whatsapp-otp] Meta قبلت الطلب: template=${opts.templateName} to=${j.contacts?.[0]?.wa_id ?? opts.to} wamid=${j.messages?.[0]?.id ?? "?"}`,
    );
  } catch {
    /* الرد ليس JSON — لا يهم */
  }
}

async function postMetaTemplate(opts: {
  cfg: WhatsappOtpConfig;
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

/* ──────────────────────────────── رسائلي ──────────────────────────────── */

/** الطلب يُعالَج في طابور عندهم: النجاح يعني القبول وليس تأكيد التسليم. */
async function postRasayilyText(opts: {
  cfg: WhatsappOtpConfig;
  phoneE164: string;
  text: string;
}): Promise<void> {
  const { cfg } = opts;
  const res = await fetch(`${RASAYILY_BASE_URL}/api/messages/send`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${cfg.rasayilyToken}`,
      "X-Company-ID": cfg.rasayilyCompanyId,
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

/* ──────────────────── Meta: قالب «تأكيد الحجز» متعدد المتغيرات ──────────────────── */

export type BookingCompletionVars = {
  fullName: string;
  bookingId: string;
  carTitle: string;
  pickupDate: string;
  dropoffDate: string;
  pickupDetails: string;
  branchLocation: string;
  paymentMethod: string;
  totalAmount: string;
};

/**
 * القالب المعتمد على Meta يستخدم متغيرات بالاسم (Named Parameters، مثل {{fullname}})
 * وليس بالترتيب الرقمي ({{1}}..) — لذا كل معامل لازم يحمل `parameter_name` مطابقاً
 * بالضبط لاسم المتغيّر في القالب المُوافَق عليه (أحرف صغيرة بلا شرطات سفلية).
 */
const BOOKING_COMPLETION_PARAM_NAMES: readonly [keyof BookingCompletionVars, string][] = [
  ["fullName", "fullname"],
  ["bookingId", "bookingid"],
  ["carTitle", "cartitle"],
  ["pickupDate", "pickupdate"],
  ["dropoffDate", "dropoffdate"],
  ["pickupDetails", "pickupdetails"],
  ["branchLocation", "branchlocation"],
  ["paymentMethod", "paymentmethod"],
  ["totalAmount", "totalamount"],
];

/**
 * قيم باراميترات قالب Meta ممنوع يبقى فيها newline/tab أو أكتر من 4 مسافات متتالية
 * (خطأ 132018) — بعض المتغيرات هنا (زي branchLocation) نص حر متعدد الأسطر أصلاً.
 */
function sanitizeMetaParamText(s: string): string {
  return s
    .replace(/[\r\n\t]+/g, " - ")
    .replace(/ {2,}/g, " ")
    .trim();
}

/** يبعت قالب Meta بمعاملات body بالاسم (Named Parameters). مشترك بين كل قوالب الحجز. */
async function postMetaNamedParamsTemplate(opts: {
  cfg: WhatsappOtpConfig;
  to: string;
  templateName: string;
  languageCode: string;
  namedParams: readonly [string, string][];
  logLabel: string;
}): Promise<void> {
  const { cfg } = opts;
  const url = `https://graph.facebook.com/${encodeURIComponent(cfg.apiVersion)}/${encodeURIComponent(
    cfg.phoneNumberId,
  )}/messages`;

  const parameters = opts.namedParams.map(([parameterName, value]) => ({
    type: "text",
    parameter_name: parameterName,
    text: sanitizeMetaParamText(value?.trim() || "—"),
  }));

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
        components: [{ type: "body", parameters }],
      },
    }),
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    const errBody = await res.text().catch(() => "");
    throw new Error(`Meta HTTP ${res.status}: ${errBody.slice(0, 500)}`);
  }

  try {
    const j = (await res.json()) as {
      messages?: { id?: string }[];
      contacts?: { wa_id?: string }[];
    };
    console.info(
      `[whatsapp-otp] Meta قبلت ${opts.logLabel}: template=${opts.templateName} to=${j.contacts?.[0]?.wa_id ?? opts.to} wamid=${j.messages?.[0]?.id ?? "?"}`,
    );
  } catch {
    /* الرد ليس JSON — لا يهم */
  }
}

async function postMetaBookingCompletionTemplate(opts: {
  cfg: WhatsappOtpConfig;
  to: string;
  vars: BookingCompletionVars;
}): Promise<void> {
  const { cfg } = opts;
  await postMetaNamedParamsTemplate({
    cfg,
    to: opts.to,
    templateName: cfg.bookingCompletionTemplateName,
    languageCode: cfg.bookingCompletionTemplateLang,
    namedParams: BOOKING_COMPLETION_PARAM_NAMES.map(([key, parameterName]) => [parameterName, opts.vars[key]]),
    logLabel: "قالب تأكيد الحجز",
  });
}

/* ──────────────── Meta: قالب «تأكيد الحجز المبدئي» (قبل الدفع) ──────────────── */

export type BookingConfirmedVars = {
  fullName: string;
  bookingId: string;
  carTitle: string;
  pickupDetails: string;
  pickupDate: string;
  numberOfDays: string;
};

const BOOKING_CONFIRMED_PARAM_NAMES: readonly [keyof BookingConfirmedVars, string][] = [
  ["fullName", "fullname"],
  ["bookingId", "bookingid"],
  ["carTitle", "cartitle"],
  ["pickupDetails", "pickupdetails"],
  ["pickupDate", "pickupdate"],
  ["numberOfDays", "numberofdays"],
];

async function postMetaBookingConfirmedTemplate(opts: {
  cfg: WhatsappOtpConfig;
  to: string;
  vars: BookingConfirmedVars;
}): Promise<void> {
  const { cfg } = opts;
  await postMetaNamedParamsTemplate({
    cfg,
    to: opts.to,
    templateName: cfg.bookingConfirmedTemplateName,
    languageCode: cfg.bookingConfirmedTemplateLang,
    namedParams: BOOKING_CONFIRMED_PARAM_NAMES.map(([key, parameterName]) => [parameterName, opts.vars[key]]),
    logLabel: "قالب تأكيد الحجز المبدئي",
  });
}

/* ───────────────────────────────── الإرسال ───────────────────────────────── */

/**
 * يرسل رمز OTP عبر مزوّد واتساب المختار للتدفّق. يرمي خطأً عند الفشل.
 * `text` نص الرسالة الكامل (Evolution/رسائلي)، و`otp` الرمز وحده (قالب Meta).
 */
export async function sendWhatsappOtp(opts: {
  flow: WhatsappOtpFlow;
  phoneE164: string;
  otp: string;
  text: string;
}): Promise<void> {
  const cfg = await getWhatsappOtpConfig();
  const provider = whatsappProviderForFlow(cfg, opts.flow);

  if (provider === "rasayily") {
    if (!isRasayilyConfigured(cfg)) throw new Error("إعدادات رسائلي غير مكتملة.");
    await postRasayilyText({ cfg, phoneE164: opts.phoneE164, text: opts.text });
    return;
  }

  const number = e164ToEvolutionWhatsAppNumber(opts.phoneE164);
  if (!number) throw new Error("رقم الجوال غير صالح لإرسال واتساب.");

  if (provider === "meta") {
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

  await sendEvolutionWhatsAppText({ number, text: opts.text });
}

/**
 * يرسل رسالة «تأكيد الحجز» الكاملة للعميل عبر مزوّد واتساب هذا التدفّق.
 * `text` نص جاهز (Evolution/رسائلي)، و`vars` تُستخدم لبناء معاملات قالب Meta المعتمد.
 */
export async function sendWhatsappBookingCompletion(opts: {
  phoneE164: string;
  text: string;
  vars: BookingCompletionVars;
}): Promise<void> {
  const cfg = await getWhatsappOtpConfig();
  const provider = cfg.bookingCompletionProvider;

  if (provider === "rasayily") {
    if (!isRasayilyConfigured(cfg)) throw new Error("إعدادات رسائلي غير مكتملة.");
    await postRasayilyText({ cfg, phoneE164: opts.phoneE164, text: opts.text });
    return;
  }

  const number = e164ToEvolutionWhatsAppNumber(opts.phoneE164);
  if (!number) throw new Error("رقم الجوال غير صالح لإرسال واتساب.");

  if (provider === "meta") {
    if (!isMetaConfiguredForFlow(cfg, "bookingCompletion")) {
      throw new Error("إعدادات Meta غير مكتملة لتدفّق تأكيد الحجز.");
    }
    await postMetaBookingCompletionTemplate({ cfg, to: number, vars: opts.vars });
    return;
  }

  await sendEvolutionWhatsAppText({ number, text: opts.text });
}

/**
 * يرسل إشعار «تأكيد الحجز المبدئي» (قبل الدفع) عبر مزوّد واتساب هذا التدفّق.
 * `text` نص جاهز (Evolution/رسائلي)، و`vars` تُستخدم لبناء معاملات قالب Meta المعتمد.
 */
export async function sendWhatsappBookingConfirmed(opts: {
  phoneE164: string;
  text: string;
  vars: BookingConfirmedVars;
}): Promise<void> {
  const cfg = await getWhatsappOtpConfig();
  const provider = cfg.bookingConfirmedProvider;

  if (provider === "rasayily") {
    if (!isRasayilyConfigured(cfg)) throw new Error("إعدادات رسائلي غير مكتملة.");
    await postRasayilyText({ cfg, phoneE164: opts.phoneE164, text: opts.text });
    return;
  }

  const number = e164ToEvolutionWhatsAppNumber(opts.phoneE164);
  if (!number) throw new Error("رقم الجوال غير صالح لإرسال واتساب.");

  if (provider === "meta") {
    if (!isMetaConfiguredForFlow(cfg, "bookingConfirmed")) {
      throw new Error("إعدادات Meta غير مكتملة لتدفّق تأكيد الحجز المبدئي.");
    }
    await postMetaBookingConfirmedTemplate({ cfg, to: number, vars: opts.vars });
    return;
  }

  await sendEvolutionWhatsAppText({ number, text: opts.text });
}
