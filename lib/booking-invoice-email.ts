import nodemailer from "nodemailer";
import { Resend } from "resend";
import { buildBookingInvoicePdfBuffer } from "@/lib/booking-invoice-pdf";
import { formatSarAmount } from "@/lib/booking-checkout-pricing";
import type { BookingPaymentSnapshot } from "@/lib/booking-payment-data";
import { getBookingForPayment } from "@/lib/booking-payment-data";
import { prisma } from "@/lib/prisma";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function paymentMethodLabelAr(code: string | null | undefined): string {
  switch (code) {
    case "TABBY":
      return "تابي";
    case "TAMARA":
      return "تمارا";
    case "CARD":
      return "بطاقة ائتمانية";
    case "APPLE_PAY":
      return "Apple Pay";
    case "POINTS":
      return "استبدال نقاط";
    default:
      return code?.trim() || "—";
  }
}

const BRANCH_LABEL_AR: Record<string, string> = {
  jeddah: "جدة",
  madinah: "المدينة المنورة",
  tabuk: "تبوك",
};

function fmtDateTime(d: Date): string {
  return d.toLocaleString("ar-SA", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildInvoiceHtml(booking: BookingPaymentSnapshot): string {
  const branchLabel = BRANCH_LABEL_AR[booking.branch] ?? booking.branch;
  const pickup = fmtDateTime(booking.pickupDate);
  const dropoffD = new Date(booking.pickupDate);
  dropoffD.setDate(dropoffD.getDate() + booking.numberOfDays);
  const dropoff = fmtDateTime(dropoffD);
  const t = booking.totals;
  const vatPct = booking.car.vatRatePercent;

  const rows: string[] = [];
  rows.push(
    `<tr><td style="padding:8px 0;border-bottom:1px solid #eee">الإيجار (${booking.numberOfDays} يوم) — ${escapeHtml(booking.car.fullTitle)}</td><td dir="ltr" style="padding:8px 0;border-bottom:1px solid #eee;text-align:left">${formatSarAmount(t.rentalExclTax)} ر.س</td></tr>`,
  );

  for (const a of booking.addons) {
    rows.push(
      `<tr><td style="padding:8px 0">${escapeHtml(a.titleAr)}</td><td dir="ltr" style="padding:8px 0;text-align:left">${formatSarAmount(a.lineTotalExclTax)} ر.س</td></tr>`,
    );
  }

  if (booking.interCityShipping && booking.interCityShipping.feeExclVatSar > 0) {
    rows.push(
      `<tr><td style="padding:8px 0">شحن بين المدن</td><td dir="ltr" style="padding:8px 0;text-align:left">${formatSarAmount(booking.interCityShipping.feeExclVatSar)} ر.س</td></tr>`,
    );
  }

  for (const f of booking.checkoutOneTimeFees) {
    rows.push(
      `<tr><td style="padding:8px 0">${escapeHtml(f.labelAr)}</td><td dir="ltr" style="padding:8px 0;text-align:left">${formatSarAmount(f.feeExclVatSar)} ر.س</td></tr>`,
    );
  }

  if (booking.delayPenalty && booking.delayPenalty.feeExclVatSar > 0) {
    rows.push(
      `<tr><td style="padding:8px 0">${escapeHtml(booking.delayPenalty.labelAr)}</td><td dir="ltr" style="padding:8px 0;text-align:left">${formatSarAmount(booking.delayPenalty.feeExclVatSar)} ر.س</td></tr>`,
    );
  }

  rows.push(
    `<tr><td style="padding:10px 0;font-weight:700">المجموع غير شامل الضريبة</td><td dir="ltr" style="padding:10px 0;text-align:left;font-weight:700">${formatSarAmount(t.subtotalExclTax)} ر.س</td></tr>`,
  );
  rows.push(
    `<tr><td style="padding:8px 0">ضريبة القيمة المضافة (${vatPct}%)</td><td dir="ltr" style="padding:8px 0;text-align:left">${formatSarAmount(t.vatAmount)} ر.س</td></tr>`,
  );
  rows.push(
    `<tr><td style="padding:12px 0;font-size:18px;font-weight:800;color:#003749">الإجمالي</td><td dir="ltr" style="padding:12px 0;text-align:left;font-size:18px;font-weight:800;color:#003749">${formatSarAmount(t.totalInclTax)} ر.س</td></tr>`,
  );

  const deliveryBlock =
    booking.pickupMode === "DELIVERY"
      ? `<p style="margin:6px 0"><strong>التوصيل:</strong> ${escapeHtml(booking.deliveryAddress?.trim() || "—")}</p>`
      : `<p style="margin:6px 0"><strong>الفرع:</strong> ${escapeHtml(branchLabel)}</p>`;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:24px;background:#f6f4ef;font-family:Tahoma,Arial,sans-serif;color:#1a1a1a">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 8px 32px rgba(0,55,73,0.08)">
      <tr><td style="background:#003749;color:#fff;padding:24px 28px">
        <h1 style="margin:0;font-size:20px">فاتورة — تم الدفع</h1>
        <p style="margin:8px 0 0;font-size:14px;opacity:0.9">طلب حجز رقم <span dir="ltr">#${booking.id}</span></p>
      </td></tr>
      <tr><td style="padding:28px">
        <p style="margin:0 0 16px">عزيزي/عزيزتي <strong>${escapeHtml(booking.fullName)}</strong>،</p>
        <p style="margin:0 0 12px;line-height:1.6">شكراً لاختياركم روائس. <strong>مُرفق مع هذه الرسالة ملف PDF</strong> يحتوي على الفاتورة للطباعة أو الأرشفة.</p>
        <p style="margin:0 0 20px;line-height:1.6">فيما يلي ملخص الفاتورة بعد إتمام الدفع (نفس المحتوى في المرفق).</p>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:20px;font-size:14px">
          <tr><td style="padding:6px 0"><strong>الجوال:</strong></td><td dir="ltr" style="padding:6px 0;text-align:left">${escapeHtml(booking.phone)}</td></tr>
          <tr><td style="padding:6px 0"><strong>المركبة:</strong></td><td style="padding:6px 0">${escapeHtml(booking.car.fullTitle)} — ${escapeHtml(booking.car.categoryTitle)}</td></tr>
          <tr><td style="padding:6px 0"><strong>الاستلام:</strong></td><td style="padding:6px 0">${escapeHtml(pickup)}</td></tr>
          <tr><td style="padding:6px 0"><strong>التسليم:</strong></td><td style="padding:6px 0">${escapeHtml(dropoff)}</td></tr>
          <tr><td style="padding:6px 0"><strong>طريقة الدفع:</strong></td><td style="padding:6px 0">${escapeHtml(paymentMethodLabelAr(booking.paymentMethod))}</td></tr>
          ${booking.paidAt ? `<tr><td style="padding:6px 0"><strong>تاريخ الدفع:</strong></td><td style="padding:6px 0">${escapeHtml(fmtDateTime(booking.paidAt))}</td></tr>` : ""}
        </table>
        ${deliveryBlock}
        <h2 style="margin:24px 0 12px;font-size:16px;color:#003749">تفاصيل المبالغ</h2>
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;border-collapse:collapse">
          ${rows.join("")}
        </table>
        <p style="margin-top:28px;font-size:12px;color:#666;line-height:1.6">هذه رسالة آلية. للاستفسار يُرجى التواصل مع خدمة العملاء عبر الموقع أو الهاتف.</p>
      </td></tr>
    </table>
  </td></tr></table>
</body>
</html>`;
}

function buildInvoicePlainText(booking: BookingPaymentSnapshot): string {
  const t = booking.totals;
  return [
    `فاتورة حجز — طلب رقم #${booking.id}`,
    "",
    `الاسم: ${booking.fullName}`,
    `الجوال: ${booking.phone}`,
    `المركبة: ${booking.car.fullTitle}`,
    `الإجمالي المدفوع: ${formatSarAmount(t.totalInclTax)} ر.س`,
    "",
    "التفاصيل الكاملة في الملف المرفق (PDF).",
    "",
    "روائس لتأجير السيارات",
  ].join("\n");
}

async function resolveInvoiceRecipientEmail(bookingRequestId: number): Promise<string | null> {
  const row = await prisma.bookingRequest.findUnique({
    where: { id: bookingRequestId },
    select: {
      contactEmail: true,
      customer: { select: { email: true } },
    },
  });
  if (!row) return null;
  const fromBooking = row.contactEmail?.trim().toLowerCase();
  if (fromBooking && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromBooking)) {
    return fromBooking;
  }
  const fromUser = row.customer?.email?.trim().toLowerCase();
  if (fromUser && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromUser)) {
    return fromUser;
  }
  return null;
}

function parseMailPort(): number {
  const n = Number(process.env.MAIL_PORT);
  if (Number.isFinite(n) && n >= 1 && n <= 65535) return Math.trunc(n);
  return 465;
}

function smtpConfigured(): boolean {
  const host = process.env.MAIL_HOST?.trim();
  const user = process.env.MAIL_USER?.trim();
  const pass = process.env.MAIL_PASS?.trim();
  return Boolean(host && user && pass);
}

async function sendInvoiceViaSmtp(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: { filename: string; content: Buffer; contentType?: string }[];
}): Promise<void> {
  const host = process.env.MAIL_HOST!.trim();
  const user = process.env.MAIL_USER!.trim();
  const pass = process.env.MAIL_PASS!.trim();
  const port = parseMailPort();
  const secureRaw = process.env.MAIL_SECURE?.trim().toLowerCase();
  const secure =
    port === 465 ? true : port === 587 ? false : secureRaw === "true" || secureRaw === "1";

  const from = process.env.MAIL_FROM?.trim() || user;

  const transporter = nodemailer.createTransport({
    host,
    port,
    secure,
    auth: { user, pass },
    ...(port === 587 ? { requireTLS: true } : {}),
  });

  await transporter.sendMail({
    from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    ...(opts.attachments?.length ? { attachments: opts.attachments } : {}),
  });
}

async function sendInvoiceViaResend(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
  attachments?: { filename: string; content: Buffer }[];
}): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  if (!apiKey) {
    throw new Error("RESEND_API_KEY غير مضبوط");
  }
  const from =
    process.env.RESEND_FROM?.trim() ||
    "روائس لتأجير السيارات <onboarding@resend.dev>";

  const resend = new Resend(apiKey);
  const { data, error } = await resend.emails.send({
    from,
    to: [opts.to],
    subject: opts.subject,
    html: opts.html,
    ...(opts.text ? { text: opts.text } : {}),
    ...(opts.attachments?.length
      ? {
          attachments: opts.attachments.map((a) => ({
            filename: a.filename,
            content: a.content.toString("base64"),
          })),
        }
      : {}),
  });
  if (error) {
    throw new Error(typeof error === "string" ? error : JSON.stringify(error));
  }
  if (data?.id) {
    console.info(`[Resend] queued email id=${data.id} to=${opts.to}`);
  }
}

/** SMTP أو Resend — لرسائل النظام (مثل رمز التحقق عند الإتمام). */
export function isOutgoingMailTransportConfigured(): boolean {
  return smtpConfigured() || Boolean(process.env.RESEND_API_KEY?.trim());
}

export async function sendPlainTransactionalEmail(opts: {
  to: string;
  subject: string;
  html: string;
  text?: string;
}): Promise<void> {
  let smtpFailure: unknown = null;
  if (smtpConfigured()) {
    try {
      await sendInvoiceViaSmtp(opts);
      return;
    } catch (e) {
      smtpFailure = e;
      console.error("[sendPlainTransactionalEmail] فشل SMTP، سيتم تجربة Resend إن وُجد:", e);
      if (!process.env.RESEND_API_KEY?.trim()) {
        throw e;
      }
    }
  }
  if (process.env.RESEND_API_KEY?.trim()) {
    try {
      await sendInvoiceViaResend(opts);
      return;
    } catch (e) {
      if (smtpFailure != null) {
        const s1 = smtpFailure instanceof Error ? smtpFailure.message : String(smtpFailure);
        const s2 = e instanceof Error ? e.message : String(e);
        throw new Error(`فشل SMTP ثم Resend. SMTP: ${s1} | Resend: ${s2}`);
      }
      throw e;
    }
  }
  if (smtpFailure != null) {
    throw smtpFailure instanceof Error ? smtpFailure : new Error(String(smtpFailure));
  }
  throw new Error("لم يُضبط إرسال البريد (SMTP أو Resend).");
}

/**
 * بعد تأكيد الدفع: إرسال فاتورة HTML مع مرفق PDF.
 * الأولوية: SMTP (`MAIL_HOST` + `MAIL_USER` + `MAIL_PASS`) ثم Resend (`RESEND_API_KEY`).
 */
export async function sendBookingInvoiceEmailAfterPayment(bookingRequestId: number): Promise<void> {
  const to = await resolveInvoiceRecipientEmail(bookingRequestId);
  if (!to) {
    console.warn(
      `[booking-invoice-email] لا يوجد بريد صالح لطلب #${bookingRequestId} — تخطّي الإرسال.`,
    );
    return;
  }

  const snapshot = await getBookingForPayment(bookingRequestId);
  if (!snapshot || snapshot.paymentStatus !== "PAID") {
    console.warn(`[booking-invoice-email] لقطة الطلب #${bookingRequestId} غير جاهزة.`);
    return;
  }

  const subject = `فاتورة حجزكم — طلب رقم #${bookingRequestId}`;
  const html = buildInvoiceHtml(snapshot);
  const text = buildInvoicePlainText(snapshot);

  let pdfBuffer: Buffer | null = null;
  try {
    pdfBuffer = await buildBookingInvoicePdfBuffer(snapshot);
  } catch (e) {
    console.error("[booking-invoice-email] تعذّر توليد PDF:", e);
  }

  const attachments =
    pdfBuffer && pdfBuffer.length > 0
      ? [
          {
            filename: `invoice-${snapshot.id}.pdf`,
            content: pdfBuffer,
            contentType: "application/pdf" as const,
          },
        ]
      : undefined;

  if (smtpConfigured()) {
    try {
      await sendInvoiceViaSmtp({ to, subject, html, text, attachments });
      return;
    } catch (e) {
      console.error("[booking-invoice-email] فشل SMTP:", e);
      return;
    }
  }

  if (process.env.RESEND_API_KEY?.trim()) {
    try {
      await sendInvoiceViaResend({
        to,
        subject,
        html,
        text,
        attachments: attachments?.map((a) => ({
          filename: a.filename,
          content: a.content,
        })),
      });
      return;
    } catch (e) {
      console.error("[booking-invoice-email] فشل Resend:", e);
      return;
    }
  }

  console.warn(
    "[booking-invoice-email] لم يُضبط إرسال البريد: عيّن MAIL_HOST و MAIL_USER و MAIL_PASS، أو RESEND_API_KEY.",
  );
}
