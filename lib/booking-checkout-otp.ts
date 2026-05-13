import bcrypt from "bcryptjs";
import {
  isOutgoingMailTransportConfigured,
  sendPlainTransactionalEmail,
} from "@/lib/booking-invoice-email";
import { prisma } from "@/lib/prisma";
import { saudiLocalNineToE164 } from "@/lib/normalize-saudi-phone";
import { getBookingOtpChannel, type BookingOtpChannel } from "@/lib/site-settings";

export type { BookingOtpChannel };

const OTP_LEN = 6;
const OTP_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 45 * 1000;
const MAX_VERIFY_ATTEMPTS = 5;

function getSmsTemplate(): string {
  return String(process.env.BOOKING_OTP_SMS_URL ?? "").trim();
}

export function isBookingOtpSmsUrlConfigured(): boolean {
  return getSmsTemplate().length > 0;
}

function phoneDestinationKey(e164: string): string {
  return `phone:${e164}`;
}

function emailDestinationKey(email: string): string {
  return `email:${email.trim().toLowerCase()}`;
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

export async function purgeExpiredBookingCheckoutOtps(): Promise<void> {
  await prisma.bookingCheckoutOtp.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
}

/** هل تظهر خطوة رمز التحقق في إتمام الحجز (القناة مفعّلة والتهيئة التقنية جاهزة). */
export async function isBookingCheckoutOtpStepRequired(): Promise<boolean> {
  const ch = await getBookingOtpChannel();
  if (ch === "OFF") return false;
  if (ch === "SMS") return isBookingOtpSmsUrlConfigured();
  if (ch === "EMAIL") return isOutgoingMailTransportConfigured();
  return false;
}

export type SendBookingCheckoutOtpResult =
  | { ok: true }
  | { ok: false; error: string; retryAfterSec?: number };

/**
 * يولّد رمزًا ويُرسله حسب إعداد الإدارة: GET على `BOOKING_OTP_SMS_URL` أو بريد SMTP/Resend.
 */
export async function sendBookingCheckoutOtpFromPublicRequest(body: {
  phone?: string;
  email?: string;
}): Promise<SendBookingCheckoutOtpResult> {
  const channel = await getBookingOtpChannel();
  if (channel === "OFF") {
    return { ok: false, error: "خدمة رمز التحقق غير مفعّلة من لوحة التحكم." };
  }

  if (channel === "SMS") {
    const localNine = String(body.phone ?? "")
      .replace(/\s+/g, "")
      .trim();
    const phoneE164 = saudiLocalNineToE164(localNine);
    if (!phoneE164) {
      return { ok: false, error: "رقم الجوال غير صالح." };
    }

    const template = getSmsTemplate();
    if (!template) {
      return { ok: false, error: "عنوان إرسال الرسائل النصية غير مضبوط في البيئة (BOOKING_OTP_SMS_URL)." };
    }

    await purgeExpiredBookingCheckoutOtps();

    const dest = phoneDestinationKey(phoneE164);
    const existing = await prisma.bookingCheckoutOtp.findUnique({
      where: { destinationKey: dest },
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
    const message = `رمز تأكيد الحجز: ${otp}`;

    const smsUrl = expandSmsUrl(template, {
      otp,
      phone: phoneE164,
      localPhone: localNine.replace(/\D/g, ""),
      message,
    });

    try {
      await prisma.bookingCheckoutOtp.upsert({
        where: { destinationKey: dest },
        create: {
          destinationKey: dest,
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
      console.error("booking checkout OTP DB upsert (SMS) failed", e);
      return {
        ok: false,
        error:
          "تعذّر حفظ رمز التحقق في قاعدة البيانات. نفّذ ترحيلات Prisma (جدول BookingCheckoutOtp) ثم أعد المحاولة.",
      };
    }

    let httpOk = false;
    try {
      const res = await fetch(smsUrl, {
        method: "GET",
        redirect: "follow",
        signal: AbortSignal.timeout(20_000),
      });
      httpOk = res.ok;
    } catch (e) {
      console.error("booking checkout OTP SMS fetch failed", e);
      await prisma.bookingCheckoutOtp.delete({ where: { destinationKey: dest } }).catch(() => {});
      return { ok: false, error: "تعذّر الاتصال بخدمة الرسائل. حاول لاحقاً." };
    }

    if (!httpOk) {
      await prisma.bookingCheckoutOtp.delete({ where: { destinationKey: dest } }).catch(() => {});
      return { ok: false, error: "رفضت خدمة الرسائل الطلب. تحقق من الإعدادات." };
    }

    return { ok: true };
  }

  if (channel !== "EMAIL") {
    return { ok: false, error: "قناة إرسال الرمز غير معروفة. راجع إعداد لوحة التحكم." };
  }

  const email = String(body.email ?? "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 255) {
    return { ok: false, error: "أدخل بريداً إلكترونياً صالحاً لإرسال رمز التحقق." };
  }
  if (!isOutgoingMailTransportConfigured()) {
    return { ok: false, error: "إرسال البريد غير مهيأ على الخادم." };
  }

  await purgeExpiredBookingCheckoutOtps();

  const dest = emailDestinationKey(email);
  const existing = await prisma.bookingCheckoutOtp.findUnique({
    where: { destinationKey: dest },
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
    await prisma.bookingCheckoutOtp.upsert({
      where: { destinationKey: dest },
      create: {
        destinationKey: dest,
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
    console.error("booking checkout OTP DB upsert (EMAIL) failed", e);
    return {
      ok: false,
      error:
        "تعذّر حفظ رمز التحقق في قاعدة البيانات. نفّذ ترحيلات Prisma (جدول BookingCheckoutOtp) ثم أعد المحاولة.",
    };
  }

  try {
    await sendPlainTransactionalEmail({
      to: email,
      subject: "رمز التحقق — إتمام الحجز",
      html: `<!DOCTYPE html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/></head>
<body style="font-family:Tahoma,Arial,sans-serif;padding:24px;background:#f6f4ef">
<p style="font-size:16px">رمز التحقق لإتمام حجزك:</p>
<p style="font-size:28px;font-weight:800;letter-spacing:0.2em" dir="ltr">${escapeHtmlLite(otp)}</p>
<p style="color:#666;font-size:13px">صالح لمدة 10 دقائق. إن لم تطلب هذا الرمز فتجاهل الرسالة.</p>
</body></html>`,
      text: `رمز التحقق لإتمام حجزك: ${otp}\n\nصالح لمدة 10 دقائق.`,
    });
  } catch (e) {
    console.error("booking checkout OTP email failed", e);
    await prisma.bookingCheckoutOtp.delete({ where: { destinationKey: dest } }).catch(() => {});
    const detail = e instanceof Error ? e.message : String(e);
    const short = detail.length > 220 ? `${detail.slice(0, 220)}…` : detail;
    return {
      ok: false,
      error: `تعذّر إرسال البريد. ${short} — إن ظهر «نجاح» سابقاً فتحقق من البريد غير الهام وصندوق الرسائل غير المرغوب فيها.`,
    };
  }

  return { ok: true };
}

export type VerifyBookingCheckoutOtpResult =
  | { ok: true }
  | { ok: false; error: string };

export async function verifyAndConsumeBookingCheckoutOtp(opts: {
  phoneLocalNine: string;
  contactEmail: string;
  codeRaw: string;
}): Promise<VerifyBookingCheckoutOtpResult> {
  const channel = await getBookingOtpChannel();
  if (channel === "OFF") {
    return { ok: true };
  }

  const code = String(opts.codeRaw ?? "")
    .replace(/\s+/g, "")
    .trim();
  if (!/^\d{6}$/.test(code)) {
    return { ok: false, error: "أدخل رمز التحقق المكوّن من 6 أرقام." };
  }

  let destinationKey: string;
  if (channel === "SMS") {
    const phoneE164 = saudiLocalNineToE164(opts.phoneLocalNine.replace(/\s+/g, "").trim());
    if (!phoneE164) {
      return { ok: false, error: "رقم الجوال غير صالح." };
    }
    destinationKey = phoneDestinationKey(phoneE164);
  } else {
    const email = opts.contactEmail.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { ok: false, error: "البريد الإلكتروني غير صالح." };
    }
    destinationKey = emailDestinationKey(email);
  }

  await purgeExpiredBookingCheckoutOtps();

  const row = await prisma.bookingCheckoutOtp.findUnique({
    where: { destinationKey },
  });
  if (!row) {
    return {
      ok: false,
      error:
        channel === "SMS"
          ? "لم يُعثر على رمز تحقق لهذا الجوال. اطلب رمزاً جديداً."
          : "لم يُعثر على رمز تحقق لهذا البريد. اطلب رمزاً جديداً.",
    };
  }
  if (row.expiresAt.getTime() < Date.now()) {
    await prisma.bookingCheckoutOtp.delete({ where: { destinationKey } }).catch(() => {});
    return { ok: false, error: "انتهت صلاحية الرمز. اطلب رمزاً جديداً." };
  }
  if (row.verifyAttempts >= MAX_VERIFY_ATTEMPTS) {
    await prisma.bookingCheckoutOtp.delete({ where: { destinationKey } }).catch(() => {});
    return { ok: false, error: "تجاوزت عدد المحاولات. اطلب رمزاً جديداً." };
  }

  const match = await bcrypt.compare(code, row.codeHash);
  if (!match) {
    await prisma.bookingCheckoutOtp.update({
      where: { destinationKey },
      data: { verifyAttempts: { increment: 1 } },
    });
    return { ok: false, error: "رمز التحقق غير صحيح." };
  }

  await prisma.bookingCheckoutOtp.delete({ where: { destinationKey } });
  return { ok: true };
}