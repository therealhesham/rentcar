/**
 * تنبيه واتساب للمطوّر عند طلب عميل رمز تحقق (OTP) لإتمام الحجز دون إكماله خلال 5 دقائق.
 *
 * المرساة `BookingCheckoutDraft`: يُنشأ لحظة إرسال الـ OTP (`/api/bookings/direct/draft`
 * أو `send-checkout-otp`) ويُحذف عند تأكيد الحجز (`/api/bookings/direct/confirm`)، فوجوده
 * بعد 5 دقائق يعني أن العميل طلب الرمز ولم يكمل. `alertSentAt` يمنع تكرار التنبيه عبر
 * تشغيلات الكرون المتلاحقة، وقفل `updateMany` التفاؤلي يمنع الإرسال المزدوج عند تداخل تشغيلين.
 *
 * يعيد استخدام مستقبِلي `FORM_FAILURE_ALERT_WHATSAPP` — نفس رقم المطوّر المُعدّ مسبقاً.
 */

import { prisma } from "@/lib/prisma";
import { parseBookingCheckoutDraftPayload } from "@/lib/booking-checkout-draft";
import { parseCreateDirectBookingInputFromCheckoutJson } from "@/lib/booking-direct-checkout-parse";
import { e164ToLocalNine } from "@/lib/normalize-saudi-phone";
import { sendEvolutionWhatsAppText, isEvolutionWhatsAppConfigured } from "@/lib/evolution-whatsapp";
import { formFailureAlertRecipients } from "@/lib/form-failure-alert";

/** أقل مدة انتظار قبل اعتبار طلب الـ OTP «مهجوراً». */
const OTP_ABANDON_DELAY_MS = 5 * 60 * 1000;

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

function buildOtpAbandonMessage(input: {
  fullName: string;
  localPhone: string;
  email: string | null;
  requestedAt: Date;
}): string {
  const lines: string[] = [];
  lines.push("🔔 *عميل طلب رمز تحقق ولم يكمل الحجز*");
  lines.push("");
  lines.push(`*الاسم:* ${input.fullName}`);
  lines.push(`*الجوال:* 0${input.localPhone}`);
  if (input.email) lines.push(`*البريد:* ${input.email}`);
  lines.push(`*وقت إرسال الرمز:* ${riyadhTimestamp(input.requestedAt)} (الرياض)`);
  lines.push("");
  lines.push("مرّت 5 دقائق دون أن يكمل التحقق أو الحجز — تم إرسال رمز التحقق له بالفعل.");
  return lines.join("\n");
}

/**
 * يفحص مسودّات الإتمام العالقة أكثر من 5 دقائق ولم يُرسَل تنبيه بشأنها بعد، ويرسل
 * تنبيه واتساب واحداً لكل مسودّة. تُستدعى من `/api/cron/otp-abandon`.
 */
export async function alertAbandonedOtpCheckoutDrafts(): Promise<{ scanned: number; alerted: number }> {
  const recipients = formFailureAlertRecipients();
  if (!recipients.length || !isEvolutionWhatsAppConfigured()) {
    return { scanned: 0, alerted: 0 };
  }

  const cutoff = new Date(Date.now() - OTP_ABANDON_DELAY_MS);
  const candidates = await prisma.bookingCheckoutDraft.findMany({
    where: { createdAt: { lte: cutoff }, alertSentAt: null },
    select: { token: true, payloadJson: true, createdAt: true },
  });

  let alerted = 0;
  for (const draft of candidates) {
    // قفل تفاؤلي: لو تشغيلا كرون تداخلا على نفس الصف، الفائز بالتحديث فقط يُرسل.
    const claimed = await prisma.bookingCheckoutDraft.updateMany({
      where: { token: draft.token, alertSentAt: null },
      data: { alertSentAt: new Date() },
    });
    if (claimed.count !== 1) continue;

    const payload = parseBookingCheckoutDraftPayload(draft.payloadJson);
    let fullName: string | null = null;
    let localPhone: string | null = null;
    let email: string | null = null;
    if (payload) {
      const parsed = await parseCreateDirectBookingInputFromCheckoutJson(payload.body, null);
      if (parsed.ok) {
        fullName = parsed.input.fullName;
        localPhone = e164ToLocalNine(parsed.input.phone);
        email = parsed.input.contactEmail ?? null;
      }
    }
    // مسودّة تالفة أو بلا هاتف صالح — لا يمكن التواصل، تخطّيها (بقيت مُقفلة بـ alertSentAt).
    if (!fullName || !localPhone) continue;

    const text = buildOtpAbandonMessage({ fullName, localPhone, email, requestedAt: draft.createdAt });
    for (const number of recipients) {
      try {
        await sendEvolutionWhatsAppText({ number, text });
      } catch (err) {
        console.error(`[otp-abandon-alert] تعذّر الإرسال إلى ${number}`, err);
      }
    }
    alerted++;
  }

  return { scanned: candidates.length, alerted };
}
