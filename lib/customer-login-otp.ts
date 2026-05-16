import bcrypt from "bcryptjs";
import {
  isOutgoingMailTransportConfigured,
  sendPlainTransactionalEmail,
} from "@/lib/booking-invoice-email";
import {
  isBookingCheckoutOtpStepRequired,
} from "@/lib/booking-checkout-otp";
import { prisma } from "@/lib/prisma";
import { e164ToLocalNine, saudiLocalNineToE164 } from "@/lib/normalize-saudi-phone";
import {
  e164ToEvolutionWhatsAppNumber,
  isEvolutionWhatsAppConfigured,
  sendEvolutionWhatsAppText,
} from "@/lib/evolution-whatsapp";
import {
  bookingOtpChannelUsesPhone,
  getBookingOtpChannel,
  type BookingOtpChannel,
} from "@/lib/site-settings";

export type { BookingOtpChannel };

const OTP_LEN = 6;
const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 45 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;

function getSmsTemplate(): string {
  return String(process.env.BOOKING_OTP_SMS_URL ?? "").trim();
}

function loginPhoneDestinationKey(e164: string): string {
  return `login:phone:${e164}`;
}

function loginEmailDestinationKey(email: string): string {
  return `login:email:${email.trim().toLowerCase()}`;
}

function randomDigits(len: number): string {
  let s = "";
  for (let i = 0; i < len; i++) {
    s += String(Math.floor(Math.random() * 10));
  }
  return s;
}

function expandSmsUrl(
  template: string,
  vars: { otp: string; phone: string; localPhone: string; message: string },
): string {
  let out = template;
  for (const [key, val] of Object.entries(vars) as [keyof typeof vars, string][]) {
    out = out.split(`{${key}}`).join(encodeURIComponent(val));
  }
  return out;
}

function escapeHtmlLite(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function purgeExpiredCustomerLoginOtps(): Promise<void> {
  await prisma.customerLoginOtp.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}

/** نفس شرط إتمام الحجز: القناة من الإدارة + تهيئة SMS أو البريد. */
export async function isCustomerLoginOtpStepRequired(): Promise<boolean> {
  return isBookingCheckoutOtpStepRequired();
}

export type SendCustomerLoginOtpResult =
  | { ok: true }
  | { ok: false; error: string; retryAfterSec?: number };

export type NormalizedLoginIdentifier =
  | { kind: "email"; email: string }
  | { kind: "phone"; localNine: string }
  | { kind: "invalid" };

export function normalizeCustomerLoginIdentifier(raw: string): NormalizedLoginIdentifier {
  const t = raw.trim();
  if (!t) return { kind: "invalid" };
  if (/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) && t.length <= 254) {
    return { kind: "email", email: t.toLowerCase() };
  }
  const d = t.replace(/\D/g, "");
  if (/^5\d{8}$/.test(d)) return { kind: "phone", localNine: d };
  return { kind: "invalid" };
}

async function findCustomerUserForLogin(norm: Exclude<NormalizedLoginIdentifier, { kind: "invalid" }>) {
  if (norm.kind === "email") {
    return prisma.user.findUnique({
      where: { email: norm.email },
      select: { id: true, isAdmin: true, email: true, phone: true },
    });
  }
  const e164 = saudiLocalNineToE164(norm.localNine);
  if (!e164) return null;
  return prisma.user.findUnique({
    where: { phone: e164 },
    select: { id: true, isAdmin: true, email: true, phone: true },
  });
}

function destinationForUserAndChannel(
  user: { email: string; phone: string | null },
  channel: BookingOtpChannel,
):
  | { ok: true; destinationKey: string; smsLocalNine?: string; emailTo?: string }
  | { ok: false; error: string } {
  if (bookingOtpChannelUsesPhone(channel)) {
    if (!user.phone) {
      return {
        ok: false,
        error:
          channel === "WHATSAPP"
            ? "لا يوجد جوال مسجّل في حسابك لتلقي الرمز عبر واتساب. حدّث بياناتك من الدعم أو استخدم تسجيل الدخول بكلمة المرور إن وُجدت."
            : "لا يوجد جوال مسجّل في حسابك لتلقي الرمز. حدّث بياناتك من الدعم أو استخدم تسجيل الدخول بكلمة المرور إن وُجدت.",
      };
    }
    const local = e164ToLocalNine(user.phone);
    if (!local) {
      return { ok: false, error: "رقم الجوال المسجّل في الحساب غير صالح." };
    }
    return {
      ok: true,
      destinationKey: loginPhoneDestinationKey(user.phone),
      smsLocalNine: local,
    };
  }
  if (channel === "EMAIL") {
    return {
      ok: true,
      destinationKey: loginEmailDestinationKey(user.email),
      emailTo: user.email.trim().toLowerCase(),
    };
  }
  return { ok: false, error: "قناة رمز التحقق غير مفعّلة." };
}

/**
 * إرسال رمز تسجيل دخول للعميل — القناة والتهيئة نفس إعداد «رمز التحقق عند إتمام الحجز» في الإدارة.
 */
export async function sendCustomerLoginOtpForIdentifier(
  rawIdentifier: string,
): Promise<SendCustomerLoginOtpResult> {
  const norm = normalizeCustomerLoginIdentifier(rawIdentifier);
  if (norm.kind === "invalid") {
    return { ok: false, error: "أدخل بريداً إلكترونياً صالحاً أو جوالاً سعودياً (9 أرقام تبدأ بـ 5)." };
  }

  const channel = await getBookingOtpChannel();
  if (channel === "OFF") {
    return { ok: false, error: "خدمة رمز تسجيل الدخول غير مفعّلة من لوحة التحكم." };
  }

  const user = await findCustomerUserForLogin(norm);
  if (!user || user.isAdmin) {
    return { ok: false, error: "لا يوجد حساب عميل بهذه البيانات." };
  }

  const dest = destinationForUserAndChannel(user, channel);
  if (!dest.ok) return dest;

  if (bookingOtpChannelUsesPhone(channel)) {
    const localNine = dest.smsLocalNine!;
    const phoneE164 = saudiLocalNineToE164(localNine);
    if (!phoneE164) {
      return { ok: false, error: "رقم الجوال غير صالح." };
    }

    if (channel === "SMS") {
      const template = getSmsTemplate();
      if (!template) {
        return { ok: false, error: "عنوان إرسال الرسائل النصية غير مضبوط في البيئة (BOOKING_OTP_SMS_URL)." };
      }
    } else if (!isEvolutionWhatsAppConfigured()) {
      return {
        ok: false,
        error:
          "إرسال واتساب غير مهيأ (EVOLUTION_API_BASE_URL و EVOLUTION_API_KEY و EVOLUTION_INSTANCE_NAME).",
      };
    }

    await purgeExpiredCustomerLoginOtps();

    const existing = await prisma.customerLoginOtp.findUnique({
      where: { destinationKey: dest.destinationKey },
      select: { lastSentAt: true },
    });
    if (existing) {
      const elapsed = Date.now() - existing.lastSentAt.getTime();
      if (elapsed < RESEND_COOLDOWN_MS) {
        const retryAfterSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
        return {
          ok: false,
          error: `انتظر ${retryAfterSec} ثانية قبل طلب رمز جديد.`,
          retryAfterSec,
        };
      }
    }

    const otp = randomDigits(OTP_LEN);
    const codeHash = await bcrypt.hash(otp, 10);
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);
    const message =
      channel === "WHATSAPP"
        ? `رمز تسجيل الدخول في روائس: ${otp}\n\nصالح لمدة 10 دقائق. إن لم تطلب هذا الرمز فتجاهل الرسالة.`
        : `رمز تسجيل الدخول: ${otp}`;

    const smsUrl =
      channel === "SMS"
        ? expandSmsUrl(getSmsTemplate(), {
            otp,
            phone: phoneE164,
            localPhone: localNine.replace(/\D/g, ""),
            message,
          })
        : null;

    try {
      await prisma.customerLoginOtp.upsert({
        where: { destinationKey: dest.destinationKey },
        create: {
          destinationKey: dest.destinationKey,
          codeHash,
          expiresAt,
          verifyAttempts: 0,
          lastSentAt: new Date(),
        },
        update: {
          codeHash,
          expiresAt,
          verifyAttempts: 0,
          lastSentAt: new Date(),
        },
      });
    } catch (e) {
      console.error("customer login OTP DB upsert (phone) failed", e);
      return {
        ok: false,
        error:
          "تعذّر حفظ رمز التحقق. نفّذ ترحيلات Prisma (جدول CustomerLoginOtp) ثم أعد المحاولة.",
      };
    }

    if (channel === "SMS" && smsUrl) {
      let httpOk = false;
      try {
        const res = await fetch(smsUrl, {
          method: "GET",
          redirect: "follow",
          signal: AbortSignal.timeout(20_000),
        });
        httpOk = res.ok;
      } catch (e) {
        console.error("customer login OTP SMS fetch failed", e);
        await prisma.customerLoginOtp
          .delete({ where: { destinationKey: dest.destinationKey } })
          .catch(() => {});
        return { ok: false, error: "تعذّر الاتصال بخدمة الرسائل. حاول لاحقاً." };
      }

      if (!httpOk) {
        await prisma.customerLoginOtp
          .delete({ where: { destinationKey: dest.destinationKey } })
          .catch(() => {});
        return { ok: false, error: "رفضت خدمة الرسائل الطلب. تحقق من الإعدادات." };
      }
    } else {
      const waNumber = e164ToEvolutionWhatsAppNumber(phoneE164);
      if (!waNumber) {
        await prisma.customerLoginOtp
          .delete({ where: { destinationKey: dest.destinationKey } })
          .catch(() => {});
        return { ok: false, error: "رقم الجوال غير صالح لإرسال واتساب." };
      }
      try {
        await sendEvolutionWhatsAppText({ number: waNumber, text: message });
      } catch (e) {
        console.error("customer login OTP WhatsApp failed", e);
        await prisma.customerLoginOtp
          .delete({ where: { destinationKey: dest.destinationKey } })
          .catch(() => {});
        return { ok: false, error: "تعذّر إرسال رمز التحقق عبر واتساب. حاول لاحقاً." };
      }
    }

    return { ok: true };
  }

  if (channel !== "EMAIL") {
    return { ok: false, error: "قناة إرسال الرمز غير معروفة." };
  }

  const email = dest.emailTo!;
  if (!isOutgoingMailTransportConfigured()) {
    return { ok: false, error: "إرسال البريد غير مهيأ على الخادم." };
  }

  await purgeExpiredCustomerLoginOtps();

  const existing = await prisma.customerLoginOtp.findUnique({
    where: { destinationKey: dest.destinationKey },
    select: { lastSentAt: true },
  });
  if (existing) {
    const elapsed = Date.now() - existing.lastSentAt.getTime();
    if (elapsed < RESEND_COOLDOWN_MS) {
      const retryAfterSec = Math.ceil((RESEND_COOLDOWN_MS - elapsed) / 1000);
      return {
        ok: false,
        error: `انتظر ${retryAfterSec} ثانية قبل طلب رمز جديد.`,
        retryAfterSec,
      };
    }
  }

  const otp = randomDigits(OTP_LEN);
  const codeHash = await bcrypt.hash(otp, 10);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  try {
    await prisma.customerLoginOtp.upsert({
      where: { destinationKey: dest.destinationKey },
      create: {
        destinationKey: dest.destinationKey,
        codeHash,
        expiresAt,
        verifyAttempts: 0,
        lastSentAt: new Date(),
      },
      update: {
        codeHash,
        expiresAt,
        verifyAttempts: 0,
        lastSentAt: new Date(),
      },
    });
  } catch (e) {
    console.error("customer login OTP DB upsert (EMAIL) failed", e);
    return {
      ok: false,
      error:
        "تعذّر حفظ رمز التحقق. نفّذ ترحيلات Prisma (جدول CustomerLoginOtp) ثم أعد المحاولة.",
    };
  }

  try {
    await sendPlainTransactionalEmail({
      to: email,
      subject: "رمز التحقق — تسجيل الدخول",
      html: `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/></head>
<body style="font-family:Tahoma,Arial,sans-serif;padding:24px;background:#f6f4ef">
<p style="font-size:16px">رمز التحقق لتسجيل الدخول:</p>
<p style="font-size:28px;font-weight:800;letter-spacing:0.2em" dir="ltr">${escapeHtmlLite(otp)}</p>
<p style="color:#666;font-size:13px">صالح لمدة 10 دقائق. إن لم تطلب هذا الرمز فتجاهل الرسالة.</p>
</body></html>`,
      text: `رمز التحقق لتسجيل الدخول: ${otp}\n\nصالح لمدة 10 دقائق.`,
    });
  } catch (e) {
    console.error("customer login OTP email failed", e);
    await prisma.customerLoginOtp.delete({ where: { destinationKey: dest.destinationKey } }).catch(() => {});
    const detail = e instanceof Error ? e.message : String(e);
    const short = detail.length > 220 ? `${detail.slice(0, 220)}…` : detail;
    return {
      ok: false,
      error: `تعذّر إرسال البريد. ${short}`,
    };
  }

  return { ok: true };
}

export type VerifyCustomerLoginOtpResult =
  | { ok: true; userId: number }
  | { ok: false; error: string };

export async function verifyAndConsumeCustomerLoginOtp(opts: {
  rawIdentifier: string;
  codeRaw: string;
}): Promise<VerifyCustomerLoginOtpResult> {
  const norm = normalizeCustomerLoginIdentifier(opts.rawIdentifier);
  if (norm.kind === "invalid") {
    return { ok: false, error: "معرّف الدخول غير صالح." };
  }

  const channel = await getBookingOtpChannel();
  if (channel === "OFF") {
    return { ok: false, error: "خدمة رمز تسجيل الدخول غير مفعّلة." };
  }

  const user = await findCustomerUserForLogin(norm);
  if (!user || user.isAdmin) {
    return { ok: false, error: "لا يوجد حساب بهذه البيانات." };
  }

  const dest = destinationForUserAndChannel(user, channel);
  if (!dest.ok) return dest;

  const code = String(opts.codeRaw ?? "")
    .replace(/\s+/g, "")
    .trim();
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, error: "أدخل رمز التحقق المكوّن من 6 أرقام." };
  }

  await purgeExpiredCustomerLoginOtps();

  const row = await prisma.customerLoginOtp.findUnique({
    where: { destinationKey: dest.destinationKey },
  });
  if (!row) {
    return {
      ok: false,
      error:
        bookingOtpChannelUsesPhone(channel)
          ? "لم يُعثر على رمز لهذا الحساب. اطلب رمزاً جديداً."
          : "لم يُعثر على رمز لهذا البريد. اطلب رمزاً جديداً.",
    };
  }
  if (row.expiresAt.getTime() < Date.now()) {
    await prisma.customerLoginOtp.delete({ where: { destinationKey: dest.destinationKey } }).catch(() => {});
    return { ok: false, error: "انتهت صلاحية الرمز. اطلب رمزاً جديداً." };
  }
  if (row.verifyAttempts >= MAX_VERIFY_ATTEMPTS) {
    await prisma.customerLoginOtp.delete({ where: { destinationKey: dest.destinationKey } }).catch(() => {});
    return { ok: false, error: "تجاوزت عدد المحاولات. اطلب رمزاً جديداً." };
  }

  const match = await bcrypt.compare(code, row.codeHash);
  if (!match) {
    await prisma.customerLoginOtp.update({
      where: { destinationKey: dest.destinationKey },
      data: { verifyAttempts: { increment: 1 } },
    });
    return { ok: false, error: "رمز التحقق غير صحيح." };
  }

  await prisma.customerLoginOtp.delete({ where: { destinationKey: dest.destinationKey } });
  return { ok: true, userId: user.id };
}
