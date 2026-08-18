/**
 * تنبيه واتساب فوري للمطوّر عند فشل نموذج الحجز.
 *
 * لوحة `/admin/logs` تعرض **العدّ** بعد وقوعه؛ هذا الملف يعطي **الحدث نفسه** لحظة
 * وقوعه مع كل ما يلزم لإعادة إنتاجه: سبب الفشل، بيانات العميل التي كتبها، السيارة
 * والتواريخ والفرع، الجهاز، ورابط الصفحة كاملاً بالـ query.
 *
 * المتغيّر البيئي:
 * - FORM_FAILURE_ALERT_WHATSAPP — رقم أو أكثر مفصولة بفاصلة (يقبل +9665… أو 05… أو 5…).
 *   إن كان فارغاً تُعطَّل التنبيهات بالكامل.
 */

import { CHECKOUT_ERROR_LABELS, shortBrowser } from "@/lib/activity-funnel";
import { sendEvolutionWhatsAppText, isEvolutionWhatsAppConfigured } from "@/lib/evolution-whatsapp";

/** الأحداث التي تستحق تنبيهاً فورياً — فشل صريح لا انسحاب صامت. */
export const FORM_FAILURE_ALERT_KINDS = ["CHECKOUT_ERROR", "KYC_UPLOAD_FAIL"] as const;

export type FormFailureAlertKind = (typeof FORM_FAILURE_ALERT_KINDS)[number];

export function isFormFailureAlertKind(kind: string): kind is FormFailureAlertKind {
  return (FORM_FAILURE_ALERT_KINDS as readonly string[]).includes(kind);
}

/**
 * سقف أمان لا سقف تحليلي: النقطة `/api/track/view` عامة، فبدون حدّ يستطيع أي أحد
 * إغراق واتساب المطوّر بطلبات ملفّقة. الحدود واسعة جداً بحيث لا تحجب فشلاً حقيقياً
 * من زائر حقيقي (لن يضغط «إتمام الحجز» ٤٠ مرة في ساعة).
 */
const MAX_ALERTS_PER_IP_PER_HOUR = 40;
const MAX_ALERTS_GLOBAL_PER_HOUR = 300;
const HOUR_MS = 60 * 60 * 1000;

type Bucket = { count: number; windowStartedAt: number };
const perIpBuckets = new Map<string, Bucket>();
const globalBucket: Bucket = { count: 0, windowStartedAt: Date.now() };

function takeFromBucket(bucket: Bucket, max: number, now: number): boolean {
  if (now - bucket.windowStartedAt >= HOUR_MS) {
    bucket.count = 0;
    bucket.windowStartedAt = now;
  }
  if (bucket.count >= max) return false;
  bucket.count++;
  return true;
}

function withinSafetyLimits(ip: string | null): boolean {
  const now = Date.now();
  if (!takeFromBucket(globalBucket, MAX_ALERTS_GLOBAL_PER_HOUR, now)) return false;

  const key = ip ?? "?";
  let bucket = perIpBuckets.get(key);
  if (!bucket) {
    bucket = { count: 0, windowStartedAt: now };
    perIpBuckets.set(key, bucket);
  }
  // تنظيف كسول حتى لا تنمو الخريطة بلا حدّ مع تغيّر عناوين الزوّار.
  if (perIpBuckets.size > 5000) {
    for (const [k, b] of perIpBuckets) {
      if (now - b.windowStartedAt >= HOUR_MS) perIpBuckets.delete(k);
    }
  }
  return takeFromBucket(bucket, MAX_ALERTS_PER_IP_PER_HOUR, now);
}

/** أرقام المستقبِلين بصيغة Evolution (9665XXXXXXXX)، من المتغيّر البيئي. */
export function formFailureAlertRecipients(): string[] {
  const raw = process.env.FORM_FAILURE_ALERT_WHATSAPP?.trim();
  if (!raw) return [];
  const out: string[] = [];
  for (const part of raw.split(",")) {
    const digits = part.replace(/\D/g, "").replace(/^0+/, "");
    const nine = digits.startsWith("966") ? digits.slice(3) : digits;
    if (!/^5\d{8}$/.test(nine)) continue;
    const number = `966${nine}`;
    if (!out.includes(number)) out.push(number);
  }
  return out;
}

export function isFormFailureAlertEnabled(): boolean {
  return isEvolutionWhatsAppConfigured() && formFailureAlertRecipients().length > 0;
}

/** تسميات عربية لمفاتيح السياق القادمة من المتصفح، بالترتيب الذي تُعرض به. */
const CONTEXT_LABELS: Array<[key: string, label: string]> = [
  ["name", "الاسم"],
  ["phone", "الجوال"],
  ["email", "البريد"],
  ["age", "الفئة العمرية"],
  ["carTitle", "السيارة"],
  ["pickup", "الاستلام"],
  ["dropoff", "التسليم"],
  ["days", "المدة"],
  ["rental", "نوع الإيجار"],
  ["idKind", "نوع الهوية"],
  ["idNumber", "رقم الهوية/الجواز"],
  ["licenseNo", "رقم الرخصة"],
  ["licenseExpiry", "انتهاء الرخصة"],
  ["idImage", "صورة الهوية"],
  ["licenseImage", "صورة الرخصة"],
  ["coupon", "كود الخصم"],
  ["editingBooking", "تعديل حجز رقم"],
  ["serverError", "رسالة الخادم"],
  ["uploadSlot", "الملف المرفوع"],
  ["uploadSize", "حجم الملف"],
];

const CONTEXT_KEY_SET = new Set(CONTEXT_LABELS.map(([key]) => key));

function riyadhTimestamp(at: Date): string {
  return at.toLocaleString("en-GB", {
    timeZone: "Asia/Riyadh",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

/**
 * وصف سبب الفشل. `CHECKOUT_ERROR` يحمل رمزاً معروفاً، بينما `KYC_UPLOAD_FAIL`
 * يحمل `slot:size:message` — نعرض رسالته كما هي لأنها نصّ الخطأ الحقيقي.
 */
function failureReason(kind: FormFailureAlertKind, detail: string | null): string {
  if (kind === "KYC_UPLOAD_FAIL") {
    const message = (detail ?? "").split(":").slice(2).join(":").trim();
    return message ? `فشل رفع الصورة — ${message}` : "فشل رفع الصورة";
  }
  const code = (detail ?? "").trim();
  if (!code) return "خطأ غير محدَّد";
  return CHECKOUT_ERROR_LABELS[code] ?? code;
}

export function buildFormFailureMessage(input: {
  kind: FormFailureAlertKind;
  detail: string | null;
  path: string | null;
  ip: string | null;
  userAgent: string | null;
  context: Record<string, string>;
  siteOrigin: string | null;
  at: Date;
}): string {
  const lines: string[] = [];
  lines.push("🚨 *فشل في نموذج الحجز*");
  lines.push("");
  lines.push(`*السبب:* ${failureReason(input.kind, input.detail)}`);
  lines.push(`*الوقت:* ${riyadhTimestamp(input.at)} (الرياض)`);
  if (input.kind === "CHECKOUT_ERROR" && input.detail?.trim()) {
    lines.push(`*الرمز:* ${input.detail.trim()}`);
  }

  const known = CONTEXT_LABELS.filter(([key]) => input.context[key]?.trim());
  if (known.length) {
    lines.push("");
    lines.push("*البيانات المُدخَلة:*");
    for (const [key, label] of known) {
      lines.push(`• ${label}: ${input.context[key].trim()}`);
    }
  }

  const extras = Object.entries(input.context).filter(
    ([key, value]) => !CONTEXT_KEY_SET.has(key) && value.trim(),
  );
  if (extras.length) {
    lines.push("");
    lines.push("*تفاصيل إضافية:*");
    for (const [key, value] of extras) lines.push(`• ${key}: ${value.trim()}`);
  }

  lines.push("");
  lines.push("*الجهاز:*");
  lines.push(`• ${shortBrowser(input.userAgent) ?? "غير معروف"}`);
  if (input.ip) lines.push(`• IP: ${input.ip}`);

  if (input.path) {
    lines.push("");
    lines.push("*الصفحة:*");
    lines.push(input.siteOrigin ? `${input.siteOrigin}${input.path}` : input.path);
  }

  return lines.join("\n");
}

/**
 * إرسال التنبيه. لا يرمي أبداً — فشل التنبيه يجب ألا يُسقط تسجيل النشاط ولا يعيد
 * خطأ للمتصفح، فالزائر لا علاقة له بهذا المسار أصلاً.
 */
export async function notifyFormFailure(input: {
  kind: FormFailureAlertKind;
  detail: string | null;
  path: string | null;
  ip: string | null;
  userAgent: string | null;
  context: Record<string, string>;
  siteOrigin: string | null;
}): Promise<void> {
  try {
    const recipients = formFailureAlertRecipients();
    if (!recipients.length || !isEvolutionWhatsAppConfigured()) return;
    if (!withinSafetyLimits(input.ip)) {
      console.warn("[form-failure-alert] تجاوز سقف الأمان — تخطّي التنبيه.");
      return;
    }

    const text = buildFormFailureMessage({ ...input, at: new Date() });
    for (const number of recipients) {
      try {
        await sendEvolutionWhatsAppText({ number, text });
      } catch (err) {
        console.error(`[form-failure-alert] تعذّر الإرسال إلى ${number}`, err);
      }
    }
  } catch (err) {
    console.error("[form-failure-alert] فشل غير متوقّع", err);
  }
}
