import {
  isCashPaymentMethod,
  invoiceTotalLabelAr,
  isInvoiceDeliveryReady,
} from "@/lib/booking-cash-flow";
import { formatSarAmount } from "@/lib/booking-checkout-pricing";
import type { BookingPaymentSnapshot } from "@/lib/booking-payment-data";
import { getBookingForPayment } from "@/lib/booking-payment-data";
import { e164ToLocalNine } from "@/lib/normalize-saudi-phone";

/**
 * إرسال إشعار واتساب بعد الدفع عبر Evolution API.
 *
 * المتغيرات البيئية:
 * - EVOLUTION_API_BASE_URL — عنوان الخادم بدون شرطة مائلة أخيرة (مثال: https://evolution.example.com)
 * - EVOLUTION_API_KEY — قيمة ترويسة apikey
 * - EVOLUTION_INSTANCE_NAME — اسم نسخة الواتساب (يُمرَّر في مسار /message/sendText/{instance})
 *
 * إن نقص أي منها يُتخطّى الإرسال دون خطأ.
 */
export function isEvolutionWhatsAppConfigured(): boolean {
  const base = process.env.EVOLUTION_API_BASE_URL?.trim();
  const key = process.env.EVOLUTION_API_KEY?.trim();
  const inst = process.env.EVOLUTION_INSTANCE_NAME?.trim();
  return Boolean(base && key && inst);
}

const BRANCH_LABEL_AR: Record<string, string> = {
  jeddah: "جدة",
  madinah: "المدينة المنورة",
  tabuk: "تبوك",
};

function paymentMethodLabelAr(code: string | null | undefined): string {
  switch (code) {
    case "TABBY":
      return "تابي";
    case "TAMARA":
      return "تمارا";
    case "CARD":
      return "بطاقة ائتمانية";
    case "CASH":
      return "الدفع عند الفرع";
    case "APPLE_PAY":
      return "Apple Pay";
    case "POINTS":
      return "استبدال نقاط";
    default:
      return code?.trim() || "—";
  }
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

/** رقم E.164 (مثل +9665xxxxxxxx) إلى صيغة Evolution (9665xxxxxxxx). */
export function e164ToEvolutionWhatsAppNumber(storedE164: string): string | null {
  const nine = e164ToLocalNine(storedE164);
  if (!nine) return null;
  return `966${nine}`;
}

export async function sendEvolutionWhatsAppText(opts: {
  number: string;
  text: string;
}): Promise<void> {
  if (!isEvolutionWhatsAppConfigured()) {
    throw new Error("Evolution API غير مهيأ (EVOLUTION_API_BASE_URL / EVOLUTION_API_KEY / EVOLUTION_INSTANCE_NAME).");
  }
  await postSendText(opts);
}

function buildBookingCompletionMessage(booking: BookingPaymentSnapshot): string {
  const branchLabel = BRANCH_LABEL_AR[booking.branch] ?? booking.branch;
  const pickup = fmtDateTime(booking.pickupDate);
  const dropoffD = new Date(booking.pickupDate);
  dropoffD.setDate(dropoffD.getDate() + booking.numberOfDays);
  const dropoff = fmtDateTime(dropoffD);
  const t = booking.totals;

  const pickupLine =
    booking.pickupMode === "DELIVERY"
      ? `التوصيل: ${booking.deliveryAddress?.trim() || "—"}`
      : `الفرع: ${branchLabel}`;

  const branchLocationLines: string[] = [];
  if (booking.branchAddress?.trim()) {
    branchLocationLines.push(`عنوان الفرع: ${booking.branchAddress.trim()}`);
  }
  if (booking.branchMapUrl?.trim()) {
    branchLocationLines.push(`موقع الفرع على الخرائط: ${booking.branchMapUrl.trim()}`);
  }

  const introLine = isCashPaymentMethod(booking.paymentMethod)
    ? booking.paymentStatus.trim().toUpperCase() === "PAID"
      ? "تم تأكيد حجزكم. تم تسجيل استلام المبلغ نقداً."
      : "تم تأكيد حجزكم. يُستحق المبلغ نقداً عند الاستلام أو في الفرع حسب الاتفاق."
    : "تم تأكيد حجزكم واستلام الدفع بنجاح.";

  return [
    `مرحباً ${booking.fullName.trim()}،`,
    "",
    introLine,
    "",
    `رقم الطلب: #${booking.id}`,
    `المركبة: ${booking.car.fullTitle}`,
    `الاستلام: ${pickup}`,
    `التسليم: ${dropoff}`,
    pickupLine,
    ...branchLocationLines,
    `طريقة الدفع: ${paymentMethodLabelAr(booking.paymentMethod)}`,
    `${invoiceTotalLabelAr(booking)}: ${formatSarAmount(t.totalInclTax)} ر.س (شامل الضريبة)`,
    "",
    "شكراً لاختياركم روائس لتأجير السيارات. نتمنى لكم رحلة آمنة.",
  ].join("\n");
}

async function postSendText(opts: { number: string; text: string }): Promise<void> {
  const base = process.env.EVOLUTION_API_BASE_URL!.trim().replace(/\/+$/, "");
  const key = process.env.EVOLUTION_API_KEY!.trim();
  const instance = process.env.EVOLUTION_INSTANCE_NAME!.trim();
  const url = `${base}/message/sendText/${encodeURIComponent(instance)}`;

  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 20_000);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
      },
      body: JSON.stringify({
        number: opts.number,
        textMessage: { text: opts.text },
        options: { linkPreview: false },
      }),
      signal: controller.signal,
    });
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`HTTP ${res.status}: ${errBody.slice(0, 500)}`);
    }
  } finally {
    clearTimeout(t);
  }
}

export async function sendBookingCompletionWhatsAppAfterPayment(bookingRequestId: number): Promise<void> {
  if (!isEvolutionWhatsAppConfigured()) {
    return;
  }

  const snapshot = await getBookingForPayment(bookingRequestId);
  if (!snapshot || !isInvoiceDeliveryReady(snapshot)) {
    console.warn(
      `[evolution-whatsapp] لقطة الطلب #${bookingRequestId} غير جاهزة لإشعار الإتمام — تخطّي واتساب.`,
    );
    return;
  }

  const number = e164ToEvolutionWhatsAppNumber(snapshot.phone);
  if (!number) {
    console.warn(
      `[evolution-whatsapp] رقم الجوال غير صالح لإرسال واتساب (طلب #${bookingRequestId}): ${snapshot.phone}`,
    );
    return;
  }

  const text = buildBookingCompletionMessage(snapshot);
  await postSendText({ number, text });
}
