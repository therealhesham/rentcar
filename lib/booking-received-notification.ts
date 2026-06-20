import { getBookingForPayment, type BookingPaymentSnapshot } from "@/lib/booking-payment-data";
import {
  isOutgoingMailTransportConfigured,
  sendPlainTransactionalEmail,
} from "@/lib/booking-invoice-email";
import { prisma } from "@/lib/prisma";
import {
  e164ToEvolutionWhatsAppNumber,
  isEvolutionWhatsAppConfigured,
  sendEvolutionWhatsAppText,
} from "@/lib/evolution-whatsapp";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

async function resolveRecipientEmail(bookingRequestId: number): Promise<string | null> {
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

export function buildReceivedHtml(booking: BookingPaymentSnapshot, isAdmin = false): string {
  const intro = isAdmin
    ? `تم تسجيل حجز جديد للعميل ${escapeHtml(booking.fullName)} للسيارة ${escapeHtml(booking.car.fullTitle)} بفرع ${escapeHtml(booking.branch)}.`
    : `شكراً لاختياركم روائس. تم استلام طلب حجزكم بنجاح وهو قيد المراجعة. سيتواصل معكم فريقنا قريباً هاتفياً لتأكيد الحجز.`;

  const title = isAdmin ? "إشعار حجز جديد" : "تم استلام حجزك بنجاح";
  const badge = isAdmin ? "🔔 حجز جديد" : "⏳ قيد المراجعة";

  const pickup = booking.pickupDate.toLocaleString("ar-SA", {
    year: "numeric",
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  const pickupLocationLabel = booking.pickupMode === "DELIVERY"
    ? booking.deliveryAddress?.trim() || "—"
    : booking.pickupBranchLabelAr?.trim() || "—";
  const returnLocationLabel = booking.returnBranchLabelAr?.trim() || "—";

  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width"/>
  <style>
    @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800&display=swap');
  </style>
</head>
<body style="margin:0;padding:40px 20px;background:#f3f4f6;font-family:'Cairo',Tahoma,Arial,sans-serif;color:#111827;-webkit-font-smoothing:antialiased;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#ffffff;border-radius:24px;overflow:hidden;box-shadow:0 20px 40px rgba(0,0,0,0.08);border:1px solid #e5e7eb;margin:0 auto;">
      <tr><td style="background:linear-gradient(135deg, #003749 0%, #001f29 100%);padding:48px 40px;text-align:center;">
        <div style="margin-bottom:24px;">
          <h2 style="margin:0;color:#dfb163;font-size:28px;font-weight:800;letter-spacing:-0.5px;">روائس</h2>
          <p style="margin:4px 0 0;color:#9ca3af;font-size:14px;">لتأجير السيارات</p>
        </div>
        
        <div style="background:rgba(255,255,255,0.1);display:inline-block;padding:8px 20px;border-radius:100px;margin-bottom:24px;border:1px solid rgba(255,255,255,0.2);">
          <span style="color:#60a5fa;font-weight:700;font-size:14px;display:flex;align-items:center;gap:6px;">
            ${badge}
          </span>
        </div>
        
        <h1 style="margin:0 0 12px;font-size:36px;font-weight:800;color:#ffffff;">${title}</h1>
        <p style="margin:0;font-size:16px;color:#cbd5e1;opacity:0.9">رقم الطلب: <span dir="ltr" style="font-family:monospace;background:rgba(0,0,0,0.2);padding:4px 8px;border-radius:6px;font-weight:600;">#${booking.id}</span></p>
      </td></tr>
      
      <tr><td style="padding:48px 40px;">
        <p style="margin:0 0 12px;font-size:18px;color:#111827;">مرحباً <strong>${escapeHtml(booking.fullName)}</strong>،</p>
        <p style="margin:0 0 36px;line-height:1.7;color:#6b7280;font-size:15px;">${intro}</p>
        
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-bottom:32px;">
          <tr>
            <td width="50%" style="padding-bottom:24px;padding-left:12px;">
              <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">السيارة</p>
              <p style="margin:0;font-size:15px;color:#111827;font-weight:700;">${escapeHtml(booking.car.fullTitle)} <span style="color:#9ca3af;font-weight:400;">(${escapeHtml(booking.car.categoryTitle)})</span></p>
            </td>
            <td width="50%" style="padding-bottom:24px;padding-right:12px;">
              <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">مدة الإيجار</p>
              <p style="margin:0;font-size:15px;color:#111827;font-weight:700;">${escapeHtml(booking.tripDurationLabelAr || booking.numberOfDays + " أيام")}</p>
            </td>
 
          <tr>
            <td width="50%" style="padding-bottom:24px;padding-left:12px;">
              <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">مكان الاستلام</p>
              <p style="margin:0;font-size:15px;color:#111827;font-weight:700;">${escapeHtml(pickupLocationLabel)}</p>
            </td>
            <td width="50%" style="padding-bottom:24px;padding-right:12px;">
              <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">مكان التسليم</p>
              <p style="margin:0;font-size:15px;color:#111827;font-weight:700;">${escapeHtml(returnLocationLabel)}</p>
            </td>
          </tr>
          <tr>
            <td width="50%" style="padding-bottom:24px;padding-left:12px;">
              <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">تاريخ ووقت الاستلام المتوقع</p>
              <p style="margin:0;font-size:15px;color:#111827;font-weight:700;" dir="ltr">${escapeHtml(pickup)}</p>
            </td>
            <td width="50%" style="padding-bottom:24px;padding-right:12px;">
              <p style="margin:0 0 6px;font-size:13px;color:#6b7280;">رقم الجوال</p>
              <p style="margin:0;font-size:15px;color:#111827;font-weight:700;" dir="ltr">${escapeHtml(booking.phone)}</p>
            </td>
          </tr>
          </table>
        
        ${!isAdmin ? `<div style="background:#fffbeb; border:1px solid #fde68a; padding:16px 20px; border-radius:12px; margin-top:32px;">
          <p style="margin:0; font-size:14px; color:#92400e; line-height:1.6;">
            <strong>ملاحظة:</strong> لن تُرسل الفاتورة إلكترونياً إلا بعد تأكيد الحجز وتسديد المبلغ المطلوب.
          </p>
        </div>` : ""}
      </td></tr>
      
      <tr><td style="background:#f9fafb;padding:24px;text-align:center;border-top:1px solid #e5e7eb;">
        <p style="margin:0;font-size:13px;color:#6b7280;font-weight:600;">© ${new Date().getFullYear()} روائس لتأجير السيارات. جميع الحقوق محفوظة.</p>
      </td></tr>
    </table>
    
    <div style="height:40px;"></div>
  </td></tr></table>
</body>
</html>`;
}

function buildReceivedPlainText(fullName: string, bookingId: number): string {
  return [
    "روائس لتأجير السيارات",
    "",
    "تم استلام حجزك بنجاح",
    "",
    `مرحباً ${fullName}،`,
    "شكراً لاختياركم روائس. تم استلام طلب حجزكم وهو قيد المراجعة.",
    "سيتواصل معكم فريقنا قريباً هاتفياً لتأكيد الحجز.",
    "",
    `رقم الطلب: #${bookingId} `,
    "",
    "لن تُرسل الفاتورة إلكترونياً إلا بعد تأكيد الحجز من قِبل فريقنا.",
  ].join("\n");
}

function buildReceivedWhatsAppText(): string {
  return ""; // unused, kept for compatibility if needed, but we'll use expandTemplate
}

/**
 * بعد تسجيل حجز نقدي (تحت المراجعة): إشعار بسيط فقط — بدون فاتورة PDF.
 */
export async function sendBookingReceivedNotification(
  bookingRequestId: number,
): Promise<void> {
  const snapshot = await getBookingForPayment(bookingRequestId);
  if (!snapshot) {
    console.warn(`[booking - received] الطلب #${bookingRequestId} غير موجود.`);
    return;
  }

  const subject = `تم استلام حجزك — طلب رقم #${bookingRequestId} `;
  const html = buildReceivedHtml(snapshot);
  const text = buildReceivedPlainText(snapshot.fullName, snapshot.id);

  if (isOutgoingMailTransportConfigured()) {
    const to = await resolveRecipientEmail(bookingRequestId);
    if (to) {
      try {
        await sendPlainTransactionalEmail({ to, subject, html, text });
      } catch (e) {
        console.error("[booking-received] فشل إرسال البريد:", e);
      }
    } else {
      console.warn(`[booking - received] لا يوجد بريد لطلب #${bookingRequestId}.`);
    }
  }

  if (isEvolutionWhatsAppConfigured()) {
    const number = e164ToEvolutionWhatsAppNumber(snapshot.phone);
    if (number) {
      try {
        const { getWhatsAppTemplate, expandTemplate } = await import("@/lib/whatsapp-templates");
        const customerTemplate = await getWhatsAppTemplate("whatsapp_template_booking_received_customer");
        await sendEvolutionWhatsAppText({
          number,
          text: expandTemplate(customerTemplate, {
            fullName: snapshot.fullName,
            bookingId: snapshot.id,
            carTitle: snapshot.car.fullTitle,
          }),
        });
      } catch (e) {
        console.error("[booking-received] فشل واتساب للعميل:", e);
      }
    }

    const waSetting = await prisma.siteSetting.findUnique({
      where: { key: "maintenance_whatsapp_numbers" }
    });
    if (waSetting && waSetting.value) {
      const numbers = waSetting.value.split(",").map(n => n.trim()).filter(Boolean);
      if (numbers.length > 0) {
        const { getWhatsAppTemplate, expandTemplate } = await import("@/lib/whatsapp-templates");
        const adminTemplate = await getWhatsAppTemplate("whatsapp_template_booking_received_admin");
        const textMaint = expandTemplate(adminTemplate, {
          bookingId: snapshot.id,
          carTitle: snapshot.car.fullTitle,
          fullName: snapshot.fullName,
          phone: snapshot.phone,
          branchLocation: snapshot.branch,
          pickupDate: snapshot.pickupDate.toLocaleString("ar-SA"),
          numberOfDays: snapshot.numberOfDays,
        });

        for (const num of numbers) {
          try {
            await sendEvolutionWhatsAppText({ number: num, text: textMaint });
          } catch (err) {
            console.error(`[booking - received] Failed to send WhatsApp to maintenance ${num} `, err);
          }
        }
      }
    }
  }

  await sendAdminEmailForNewBooking(bookingRequestId);
}

export async function sendAdminEmailForNewBooking(bookingRequestId: number): Promise<void> {
  const snapshot = await getBookingForPayment(bookingRequestId);
  if (!snapshot) return;

  if (isOutgoingMailTransportConfigured()) {
    const emailSetting = await prisma.siteSetting.findUnique({
      where: { key: "car_bookings_emails" }
    });
    if (emailSetting && emailSetting.value) {
      const adminEmails = emailSetting.value.split(",").map(e => e.trim()).filter(Boolean);
      if (adminEmails.length > 0) {
        const adminSubject = `حجز أفراد جديد — طلب #${snapshot.id} `;
        const adminHtml = buildReceivedHtml(snapshot, true);

        for (const email of adminEmails) {
          try {
            await sendPlainTransactionalEmail({ to: email, subject: adminSubject, html: adminHtml, text: buildReceivedPlainText(snapshot.fullName, snapshot.id) });
          } catch (e) {
            console.error(`[booking - received] Failed to send admin email to ${email} `, e);
          }
        }
      }
    }
  }
}
