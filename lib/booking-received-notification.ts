import { getBookingForPayment } from "@/lib/booking-payment-data";
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

function buildReceivedHtml(fullName: string, bookingId: number): string {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head><meta charset="utf-8"/><meta name="viewport" content="width=device-width"/></head>
<body style="margin:0;padding:32px 16px;background:#f3f4f6;font-family:Tahoma,Arial,sans-serif;color:#111827;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center">
    <table role="presentation" width="100%" style="max-width:520px;background:#fff;border-radius:16px;border:1px solid #e5e7eb;padding:32px 28px;">
      <tr><td>
        <p style="margin:0 0 8px;font-size:13px;color:#6b7280;font-weight:600;">روائس لتأجير السيارات</p>
        <h1 style="margin:0 0 16px;font-size:22px;font-weight:800;color:#003749;">تم استلام حجزك بنجاح</h1>
        <p style="margin:0 0 20px;line-height:1.7;color:#4b5563;font-size:15px;">
          مرحباً <strong>${escapeHtml(fullName)}</strong>،
          شكراً لاختياركم روائس. تم استلام طلب حجزكم بنجاح وهو قيد المراجعة.
          سيتواصل معكم فريقنا قريباً هاتفياً لتأكيد الحجز.
        </p>
        <p style="margin:0;font-size:14px;color:#6b7280;">رقم الطلب: <strong dir="ltr" style="color:#003749;">#${bookingId}</strong></p>
        <p style="margin:24px 0 0;font-size:12px;color:#9ca3af;line-height:1.6;">
          لن تُرسل الفاتورة إلكترونياً إلا بعد تأكيد الحجز من قِبل فريقنا.
        </p>
      </td></tr>
    </table>
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
    `رقم الطلب: #${bookingId}`,
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
    console.warn(`[booking-received] الطلب #${bookingRequestId} غير موجود.`);
    return;
  }

  const subject = `تم استلام حجزك — طلب رقم #${bookingRequestId}`;
  const html = buildReceivedHtml(snapshot.fullName, snapshot.id);
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
      console.warn(`[booking-received] لا يوجد بريد لطلب #${bookingRequestId}.`);
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
            console.error(`[booking-received] Failed to send WhatsApp to maintenance ${num}`, err);
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
        const adminSubject = `حجز أفراد جديد — طلب #${snapshot.id}`;
        const adminHtml = buildReceivedHtml(snapshot.fullName, snapshot.id)
          .replace("شكراً لاختياركم روائس. تم استلام طلب حجزكم بنجاح وهو قيد المراجعة.", `تم تسجيل حجز جديد للعميل ${escapeHtml(snapshot.fullName)} للسيارة ${escapeHtml(snapshot.car.fullTitle)} بفرع ${escapeHtml(snapshot.branch)}.`);
        
        for (const email of adminEmails) {
          try {
            await sendPlainTransactionalEmail({ to: email, subject: adminSubject, html: adminHtml, text: buildReceivedPlainText(snapshot.fullName, snapshot.id) });
          } catch (e) {
            console.error(`[booking-received] Failed to send admin email to ${email}`, e);
          }
        }
      }
    }
  }
}
