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

function buildReceivedWhatsAppText(fullName: string, bookingId: number, carTitle: string): string {
  return [
    `مرحباً ${fullName.trim()}،`,
    "",
    "تم استلام حجزك بنجاح.",
    "",
    `رقم الطلب: #${bookingId}`,
    `المركبة: ${carTitle}`,
    "",
    "طلبكم قيد المراجعة — سيتواصل معكم فريق روائس قريباً لتأكيد الحجز هاتفياً.",
    "ستُرسل الفاتورة بعد التأكيد.",
    "",
    "شكراً لاختياركم روائس لتأجير السيارات.",
  ].join("\n");
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
        await sendEvolutionWhatsAppText({
          number,
          text: buildReceivedWhatsAppText(
            snapshot.fullName,
            snapshot.id,
            snapshot.car.fullTitle,
          ),
        });
      } catch (e) {
        console.error("[booking-received] فشل واتساب:", e);
      }
    }

    const waSetting = await prisma.siteSetting.findUnique({
      where: { key: "maintenance_whatsapp_numbers" }
    });
    if (waSetting && waSetting.value) {
      const numbers = waSetting.value.split(",").map(n => n.trim()).filter(Boolean);
      if (numbers.length > 0) {
        const text = [
          `🚨 *حجز أفراد جديد مسجل*`,
          ``,
          `*رقم الطلب:* #${snapshot.id}`,
          `*المركبة:* ${snapshot.car.fullTitle}`,
          `*العميل:* ${snapshot.fullName}`,
          `*رقم الجوال:* ${snapshot.phone}`,
          `*الفرع:* ${snapshot.branch}`,
          `*تاريخ الاستلام:* ${snapshot.pickupDate.toLocaleString("ar-SA")}`,
          `*المدة:* ${snapshot.numberOfDays} أيام`
        ].join("\n");
        
        for (const num of numbers) {
          try {
            await sendEvolutionWhatsAppText({ number: num, text });
          } catch (err) {
            console.error(`[booking-received] Failed to send WhatsApp to maintenance ${num}`, err);
          }
        }
      }
    }
  }
}
