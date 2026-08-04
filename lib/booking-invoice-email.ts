import nodemailer from "nodemailer";
import { Resend } from "resend";
import {
  invoiceEmailHeaderForBooking,
  invoiceTotalLabelAr,
  isInvoiceDeliveryReady,
} from "@/lib/booking-cash-flow";
import { buildBookingInvoicePdfBuffer } from "@/lib/booking-invoice-pdf";
import { formatSarAmountHtml, formatSarAmountPlain, SAUDI_RIYAL_FONT_CSS_URL } from "@/lib/sar-currency";
import type { BookingPaymentSnapshot } from "@/lib/booking-payment-data";
import { getBookingForPayment } from "@/lib/booking-payment-data";
import { bookingPaymentMethodLabelAr } from "@/lib/booking-payment-method-label";
import { prisma } from "@/lib/prisma";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function fmtDateTime(d: Date): string {
  return d.toLocaleString("ar-SA", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function buildInvoiceHtml(booking: BookingPaymentSnapshot): string {
  const header = invoiceEmailHeaderForBooking(booking);
  const totalLabel = invoiceTotalLabelAr(booking);
  const branchLabel = booking.pickupBranchLabelAr?.trim() || "—";
  const pickup = fmtDateTime(booking.pickupDate);
  const dropoffD = new Date(booking.pickupDate);
  dropoffD.setDate(dropoffD.getDate() + booking.numberOfDays);
  const dropoff = fmtDateTime(dropoffD);
  const t = booking.totals;
  const vatPct = booking.car.vatRatePercent;

  const rows: string[] = [];
  const rentalDuration =
    booking.tripDurationLabelAr ?? `${booking.numberOfDays} يوم`;

  const rowStyle =
    "padding:16px 20px; border-bottom:1px solid #f0f0f0; color:#4b5563; font-size:14px;";
  const valStyle =
    "padding:16px 20px; border-bottom:1px solid #f0f0f0; text-align:left; font-weight:600; color:#111827; font-size:15px;";

  rows.push(
    `<tr><td style="${rowStyle}">الإيجار (${escapeHtml(rentalDuration)}) — ${escapeHtml(booking.car.fullTitle)}</td><td dir="ltr" style="${valStyle}">${formatSarAmountHtml(t.rentalExclTax)}</td></tr>`,
  );

  for (const a of booking.addons) {
    rows.push(
      `<tr><td style="${rowStyle}">${escapeHtml(a.titleAr)}</td><td dir="ltr" style="${valStyle}">${formatSarAmountHtml(a.lineTotalExclTax)}</td></tr>`,
    );
  }

  if (booking.interCityShipping && booking.interCityShipping.feeExclVatSar > 0) {
    rows.push(
      `<tr><td style="${rowStyle}">شحن بين المدن</td><td dir="ltr" style="${valStyle}">${formatSarAmountHtml(booking.interCityShipping.feeExclVatSar)}</td></tr>`,
    );
  }

  for (const f of booking.checkoutOneTimeFees) {
    rows.push(
      `<tr><td style="${rowStyle}">${escapeHtml(f.labelAr)}</td><td dir="ltr" style="${valStyle}">${formatSarAmountHtml(f.feeExclVatSar)}</td></tr>`,
    );
  }

  if (booking.delayPenalty && booking.delayPenalty.feeExclVatSar > 0) {
    rows.push(
      `<tr><td style="${rowStyle}">${escapeHtml(booking.delayPenalty.labelAr)}</td><td dir="ltr" style="${valStyle}">${formatSarAmountHtml(booking.delayPenalty.feeExclVatSar)}</td></tr>`,
    );
  }

  rows.push(
    `<tr><td style="padding:16px 20px; border-bottom:1px solid #f0f0f0; color:#111827; font-weight:700; font-size:15px;">المجموع غير شامل الضريبة</td><td dir="ltr" style="${valStyle}">${formatSarAmountHtml(t.subtotalExclTax)}</td></tr>`,
  );
  rows.push(
    `<tr><td style="${rowStyle}">ضريبة القيمة المضافة (${vatPct}%)</td><td dir="ltr" style="${valStyle}">${formatSarAmountHtml(t.vatAmount)}</td></tr>`,
  );

  const deliveryBlock =
    booking.pickupMode === "DELIVERY"
      ? `<div style="background:#f9fafb; padding:16px 20px; border-radius:12px; margin-top:24px; border:1px solid #e5e7eb;">
           <p style="margin:0; font-size:13px; color:#6b7280; margin-bottom:6px;">موقع التوصيل</p>
           <p style="margin:0; font-size:15px; color:#111827; font-weight:700;">${escapeHtml(booking.deliveryAddress?.trim() || "—")}</p>
         </div>`
      : `<div style="background:#f9fafb; padding:16px 20px; border-radius:12px; margin-top:24px; border:1px solid #e5e7eb;">
           <p style="margin:0; font-size:13px; color:#6b7280; margin-bottom:6px;">فرع الاستلام</p>
           <p style="margin:0; font-size:15px; color:#111827; font-weight:700;">${escapeHtml(branchLabel)}</p>
         </div>`;

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width"/>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&display=swap');
    @import url('${SAUDI_RIYAL_FONT_CSS_URL}');
  </style>
</head>
<body style="margin:0;padding:40px 20px;background:#f3f4f6;font-family:'Tajawal',Tahoma,Arial,sans-serif;color:#111827;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    
    <!-- Main Container -->
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.08);border:1px solid #e5e7eb;margin:0 auto;">
      
      <!-- Header -->
      <tr><td style="background:linear-gradient(135deg, #003749 0%, #001f29 100%);padding:48px 40px;text-align:center;">
        <div style="margin-bottom:24px;">
          <h2 style="margin:0;color:#dfb163;font-size:28px;font-weight:800;letter-spacing:-0.5px;">روائس</h2>
          <p style="margin:4px 0 0;color:#9ca3af;font-size:14px;">لتأجير السيارات</p>
        </div>
        
        <div style="background:rgba(255,255,255,0.1);display:inline-block;padding:8px 20px;border-radius:100px;margin-bottom:24px;border:1px solid rgba(255,255,255,0.2);">
          <span style="color:#10b981;font-weight:700;font-size:14px;display:flex;align-items:center;gap:6px;">
            ${escapeHtml(header.badge)}
          </span>
        </div>
        
        <h1 style="margin:0 0 12px;font-size:36px;font-weight:800;color:#ffffff;">${escapeHtml(header.title)}</h1>
        <p style="margin:0;font-size:16px;color:#cbd5e1;opacity:0.9">رقم المرجع: <span dir="ltr" style="font-family:monospace;background:rgba(0,0,0,0.2);padding:4px 8px;border-radius:6px;font-weight:600;">#${booking.id}</span></p>
      </td></tr>
      
      <!-- Body -->
      <tr><td style="padding:48px 40px;">
        <p style="margin:0 0 12px;font-size:18px;color:#111827;">مرحباً <strong>${escapeHtml(booking.fullName)}</strong>،</p>
        <p style="margin:0 0 36px;line-height:1.7;color:#6b7280;font-size:15px;">${escapeHtml(header.intro)}</p>
        
        <!-- Info Grid -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
          <tr>
            <td width="50%" style="padding-bottom:24px;padding-left:12px;">
              <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">المركبة</p>
              <p style="margin:0;font-size:15px;color:#111827;font-weight:700;">${escapeHtml(booking.car.fullTitle)} <span style="color:#9ca3af;font-weight:400;">(${escapeHtml(booking.car.categoryTitle)})</span></p>
            </td>
            <td width="50%" style="padding-bottom:24px;padding-right:12px;">
              <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">طريقة الدفع</p>
              <p style="margin:0;font-size:15px;color:#111827;font-weight:700;">${escapeHtml(bookingPaymentMethodLabelAr(booking.paymentMethod))}</p>
            </td>
          </tr>
          <tr>
            <td width="50%" style="padding-bottom:24px;padding-left:12px;">
              <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">تاريخ ووقت الاستلام</p>
              <p style="margin:0;font-size:15px;color:#111827;font-weight:700;" dir="ltr">${escapeHtml(pickup)}</p>
            </td>
            <td width="50%" style="padding-bottom:24px;padding-right:12px;">
              <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">تاريخ ووقت التسليم</p>
              <p style="margin:0;font-size:15px;color:#111827;font-weight:700;" dir="ltr">${escapeHtml(dropoff)}</p>
            </td>
          </tr>
          ${
            booking.paidAt
              ? `<tr>
            <td width="50%" style="padding-left:12px;">
              <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">تاريخ الدفع</p>
              <p style="margin:0;font-size:15px;color:#111827;font-weight:700;" dir="ltr">${escapeHtml(fmtDateTime(booking.paidAt))}</p>
            </td>
            <td width="50%" style="padding-right:12px;">
              <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">رقم الجوال</p>
              <p style="margin:0;font-size:15px;color:#111827;font-weight:700;" dir="ltr">${escapeHtml(booking.phone)}</p>
            </td>
          </tr>`
              : ""
          }
        </table>
        
        ${deliveryBlock}
        
        <div style="margin:48px 0 20px;border-bottom:2px solid #f3f4f6;padding-bottom:16px;">
          <h2 style="margin:0;font-size:20px;font-weight:800;color:#003749;">تفاصيل الفاتورة</h2>
        </div>
        
        <!-- Amounts Table -->
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #e5e7eb;border-radius:12px;overflow:hidden;">
          ${rows.join("")}
          <tr>
            <td style="padding:24px 20px; background:#f9fafb; font-size:18px; font-weight:800; color:#003749;">${escapeHtml(totalLabel)}</td>
            <td dir="ltr" style="padding:24px 20px; background:#f9fafb; text-align:left; font-size:22px; font-weight:800; color:#dfb163;">${formatSarAmountHtml(t.totalInclTax)}</td>
          </tr>
        </table>
        
        <p style="margin-top:48px;margin-bottom:0;font-size:13px;color:#9ca3af;line-height:1.7;text-align:center;padding-top:24px;border-top:1px solid #f3f4f6;">
          هذا الإيصال تم إصداره آلياً ولا يتطلب توقيع.<br/>
          لأي استفسارات، يسعدنا تواصلكم مع خدمة العملاء.
        </p>
      </td></tr>
      
      <!-- Footer -->
      <tr><td style="background:#f9fafb;padding:24px;text-align:center;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:13px;color:#6b7280;font-weight:600;">© ${new Date().getFullYear()} روائس لتأجير السيارات. جميع الحقوق محفوظة.</p>
      </td></tr>
      
    </table>
    
    <!-- Padding Bottom -->
    <div style="height:40px;"></div>
    
  </td></tr></table>
</body>
</html>`;
}

function buildInvoicePlainText(booking: BookingPaymentSnapshot): string {
  const t = booking.totals;
  const totalLabel = invoiceTotalLabelAr(booking);
  return [
    `فاتورة حجز — طلب رقم #${booking.id}`,
    "",
    `الاسم: ${booking.fullName}`,
    `الجوال: ${booking.phone}`,
    `المركبة: ${booking.car.fullTitle}`,
    `${totalLabel}: ${formatSarAmountPlain(t.totalInclTax)}`,
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
  cc?: string;
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
    ...(opts.cc ? { cc: opts.cc } : {}),
    subject: opts.subject,
    html: opts.html,
    text: opts.text,
    ...(opts.attachments?.length ? { attachments: opts.attachments } : {}),
  });
}

async function sendInvoiceViaResend(opts: {
  to: string;
  cc?: string;
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
    ...(opts.cc ? { cc: opts.cc.split(",").map((s) => s.trim()) } : {}),
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
  /** قايمة إيميلات مفصولة بفاصلة — نسخة CC اختيارية. */
  cc?: string;
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

async function deliverBookingInvoiceEmail(bookingRequestId: number, bypassReadyCheck = false): Promise<{ to: string }> {
  const to = await resolveInvoiceRecipientEmail(bookingRequestId);
  if (!to) {
    throw new Error("NO_RECIPIENT");
  }

  const snapshot = await getBookingForPayment(bookingRequestId);
  if (!snapshot) {
    throw new Error("NOT_READY");
  }
  
  if (!bypassReadyCheck && !isInvoiceDeliveryReady(snapshot)) {
    throw new Error("NOT_READY");
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
      return { to };
    } catch (e) {
      console.error("[booking-invoice-email] فشل SMTP:", e);
      if (!process.env.RESEND_API_KEY?.trim()) {
        throw e;
      }
    }
  }

  if (process.env.RESEND_API_KEY?.trim()) {
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
    return { to };
  }

  throw new Error("MAIL_NOT_CONFIGURED");
}

/**
 * بعد تأكيد الدفع: إرسال فاتورة HTML مع مرفق PDF.
 * الأولوية: SMTP (`MAIL_HOST` + `MAIL_USER` + `MAIL_PASS`) ثم Resend (`RESEND_API_KEY`).
 */
export async function sendBookingInvoiceEmailAfterPayment(bookingRequestId: number): Promise<void> {
  try {
    await deliverBookingInvoiceEmail(bookingRequestId, false);
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "NO_RECIPIENT") {
      console.warn(
        `[booking-invoice-email] لا يوجد بريد صالح لطلب #${bookingRequestId} — تخطّي الإرسال.`,
      );
      return;
    }
    if (msg === "NOT_READY") {
      console.warn(`[booking-invoice-email] لقطة الطلب #${bookingRequestId} غير جاهزة.`);
      return;
    }
    if (msg === "MAIL_NOT_CONFIGURED") {
      console.warn(
        "[booking-invoice-email] لم يُضبط إرسال البريد: عيّن MAIL_HOST و MAIL_USER و MAIL_PASS، أو RESEND_API_KEY.",
      );
      return;
    }
    console.error("[booking-invoice-email] فشل الإرسال:", e);
  }
}

export type ResendBookingInvoiceResult =
  | { ok: true; to: string }
  | { ok: false; error: string };

/** إعادة إرسال فاتورة الحجز (بعد الدفع) — مع رسائل خطأ للواجهة. */
export async function resendBookingInvoiceEmail(
  bookingRequestId: number,
): Promise<ResendBookingInvoiceResult> {
  if (!Number.isInteger(bookingRequestId) || bookingRequestId < 1) {
    return { ok: false, error: "معرّف الطلب غير صالح." };
  }
  if (!isOutgoingMailTransportConfigured()) {
    return { ok: false, error: "إرسال البريد غير مفعّل على الخادم." };
  }
  try {
    const { to } = await deliverBookingInvoiceEmail(bookingRequestId, true);
    return { ok: true, to };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg === "NO_RECIPIENT") {
      return { ok: false, error: "لا يوجد بريد إلكتروني مسجّل لهذا الحجز." };
    }
    if (msg === "NOT_READY") {
      return {
        ok: false,
        error:
          "إعادة الإرسال متاحة بعد إتمام الدفع، أو بعد تسجيل إرجاع السيارة إلى الفرع (للدفع عند الفرع).",
      };
    }
    if (msg === "MAIL_NOT_CONFIGURED") {
      return { ok: false, error: "إرسال البريد غير مفعّل على الخادم." };
    }
    console.error("[booking-invoice-email] فشل إعادة الإرسال:", e);
    return { ok: false, error: "تعذّر إرسال الفاتورة. حاول مرة أخرى لاحقاً." };
  }
}
