import "server-only";

/**
 * عميل MSEGAT لرموز التحقق عبر SMS. التوثيق:
 * https://documenter.getpostman.com/view/39158411/2sBY4LT3EY
 *
 * الفارق الجوهري عن الإرسال العادي: **MSEGAT هي التي تولّد الرمز وتتحقق منه**.
 * نحن نحتفظ بالـ`id` العائد من الإرسال ونعيده مع الرمز الذي كتبه العميل — فلا
 * يمرّ الرمز نفسه بخوادمنا ولا يُخزَّن عندنا إطلاقاً.
 *
 * المصادقة تُرسل في **جسم الطلب** (userName + apiKey) لا في الترويسات.
 */

const BASE = "https://www.msegat.com/gw";

type MsegatConfig = {
  userName: string;
  apiKey: string;
  /** اسم المرسِل — يجب تفعيله من لوحة msegat، بحد أقصى 11 حرفاً. */
  sender: string;
};

export function getMsegatConfig(): MsegatConfig | null {
  const userName = process.env.MSEGAT_USERNAME?.trim();
  const apiKey = process.env.MSEGAT_API_KEY?.trim();
  const sender = process.env.MSEGAT_SENDER?.trim();
  if (!userName || !apiKey || !sender) return null;
  return { userName, apiKey, sender };
}

export function isMsegatConfigured(): boolean {
  return getMsegatConfig() != null;
}

/** MSEGAT تطلب الصيغة الدولية بدون أصفار ولا علامة زائد: 9665XXXXXXXX. */
export function toMsegatNumber(phoneE164: string): string | null {
  const digits = phoneE164.replace(/\D/g, "");
  return /^9665\d{8}$/.test(digits) ? digits : null;
}

/**
 * أكواد MSEGAT: النجاح "1" أو "M0000". الباقي أخطاء بعائلتين (M00xx ورقمية).
 * لا تُعرض تفاصيلها للعميل — بعضها يكشف حالة الحساب (رصيد، بيانات دخول).
 */
const SUCCESS_CODES = new Set(["1", "M0000"]);

const ERROR_HINTS: Record<string, string> = {
  "1010": "متغيرات ناقصة في الطلب",
  "1020": "بيانات دخول MSEGAT غير صحيحة",
  "1050": "نص الرسالة فارغ",
  "1060": "رصيد MSEGAT غير كافٍ",
  "1061": "رسالة مكررة",
  "1064": "وضع OTP المجاني — نص الرسالة غير مطابق",
  M0001: "متغيرات ناقصة في الطلب",
  M0002: "بيانات دخول MSEGAT غير صحيحة",
  M0008: "بادئة رقم الجوال غير صحيحة",
  M0026: "اسم المرسِل غير مفعّل أو غير موجود",
  M0034: "يجب استخدام POST",
  M0037: "الحساب يتطلب إرسالاً من IP ثابت",
};

/** وصف الخطأ للسجلات فقط — الرسالة المعروضة للعميل تبقى عامة. */
function describeCode(code: string, message?: string): string {
  const hint = ERROR_HINTS[code];
  return hint ? `${code} (${hint})` : `${code}${message ? ` — ${message}` : ""}`;
}

type MsegatResponse = {
  id?: string | number;
  code?: string | number;
  message?: string;
  success?: boolean;
};

async function msegatPost(path: string, body: unknown): Promise<MsegatResponse> {
  const res = await fetch(`${BASE}/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`MSEGAT ${path} → HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  try {
    return JSON.parse(text) as MsegatResponse;
  } catch {
    throw new Error(`MSEGAT ${path} → رد غير صالح: ${text.slice(0, 200)}`);
  }
}

/**
 * يُخزَّن مرجع MSEGAT في نفس عمود `codeHash` الموجود (لا حاجة لهجرة قاعدة بيانات).
 * البادئة تجعل الصف واصفاً لنفسه: صفوف القنوات المحلية (بريد/واتساب) تبقى هاش
 * bcrypt، وصفوف SMS تحمل `msegat:{id}` — فلا يُخلط بينهما عند التحقق.
 */
const MSEGAT_REF_PREFIX = "msegat:";

export function msegatRefValue(id: string): string {
  return `${MSEGAT_REF_PREFIX}${id}`;
}

/** يُرجع مُعرِّف MSEGAT إن كان الصف يخصّها، وإلا `null` (تحقق محلي). */
export function parseMsegatRef(storedValue: string): string | null {
  if (!storedValue.startsWith(MSEGAT_REF_PREFIX)) return null;
  const id = storedValue.slice(MSEGAT_REF_PREFIX.length).trim();
  return id || null;
}

export type MsegatSendOtpResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/**
 * إرسال رمز تحقق. الرمز يُولَّد ويُخزَّن لدى MSEGAT — نُعيد الـ`id` فقط ليُحفظ
 * لدينا ويُستخدم لاحقاً في التحقق.
 */
export async function sendMsegatOtp(args: {
  phoneE164: string;
  lang?: "Ar" | "En";
}): Promise<MsegatSendOtpResult> {
  const cfg = getMsegatConfig();
  if (!cfg) return { ok: false, error: "خدمة الرسائل غير مهيّأة." };

  const number = toMsegatNumber(args.phoneE164);
  if (!number) return { ok: false, error: "رقم الجوال غير صالح." };

  let data: MsegatResponse;
  try {
    data = await msegatPost("sendOTPCode.php", {
      userName: cfg.userName,
      apiKey: cfg.apiKey,
      userSender: cfg.sender,
      number,
      lang: args.lang ?? "Ar",
    });
  } catch (e) {
    console.error("[msegat] sendOTPCode failed:", e);
    return { ok: false, error: "تعذّر الاتصال بخدمة الرسائل. حاول لاحقاً." };
  }

  const code = String(data.code ?? "");
  const id = data.id != null ? String(data.id) : "";
  if (!SUCCESS_CODES.has(code) || !id) {
    console.error("[msegat] sendOTPCode rejected:", describeCode(code, data.message));
    return { ok: false, error: "تعذّر إرسال رمز التحقق. حاول لاحقاً." };
  }

  return { ok: true, id };
}

export type MsegatVerifyOtpResult =
  | { ok: true }
  | { ok: false; error: string; /** خطأ شبكة/خدمة لا خطأ في الرمز */ transient?: boolean };

/**
 * التحقق من الرمز لدى MSEGAT. `id` هو العائد من الإرسال.
 *
 * `transient` يفرّق بين «الرمز غلط» و«الخدمة تعذّرت»: الأول يستهلك محاولة من
 * رصيد العميل، والثاني لا يجوز أن يُحسب عليه.
 */
export async function verifyMsegatOtp(args: {
  id: string;
  code: string;
  lang?: "Ar" | "En";
}): Promise<MsegatVerifyOtpResult> {
  const cfg = getMsegatConfig();
  if (!cfg) return { ok: false, error: "خدمة الرسائل غير مهيّأة.", transient: true };

  // توثيقهم متناقض في نوع `id`: الإرسال يُرجعه نصاً ومثال التحقق يظهره رقماً.
  // نُرسله رقماً متى كان رقمياً بحتاً، وإلا نصاً — تفادياً لتحقّق صارم على النوع.
  const idPayload: string | number = /^\d+$/.test(args.id) ? Number(args.id) : args.id;

  let data: MsegatResponse;
  try {
    data = await msegatPost("verifyOTPCode.php", {
      userName: cfg.userName,
      apiKey: cfg.apiKey,
      userSender: cfg.sender,
      id: idPayload,
      code: args.code,
      lang: args.lang ?? "Ar",
    });
  } catch (e) {
    console.error("[msegat] verifyOTPCode failed:", e);
    return { ok: false, error: "تعذّر الاتصال بخدمة التحقق. حاول لاحقاً.", transient: true };
  }

  const code = String(data.code ?? "");
  if (SUCCESS_CODES.has(code)) return { ok: true };

  // أخطاء التهيئة (بيانات دخول/متغيرات) ليست خطأ العميل — تُسجَّل ولا تُستهلك محاولة.
  if (code === "1020" || code === "M0002" || code === "1010" || code === "M0001") {
    console.error("[msegat] verifyOTPCode config error:", describeCode(code, data.message));
    return { ok: false, error: "تعذّر التحقق حالياً. حاول لاحقاً.", transient: true };
  }

  return { ok: false, error: "رمز التحقق غير صحيح." };
}
