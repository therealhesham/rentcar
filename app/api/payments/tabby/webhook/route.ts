import { NextResponse } from "next/server";
import { fetchTabbyPayment, isTabbyConfigured } from "@/lib/tabby/client";
import {
  applyAuthorizedTabbyPaymentToBooking,
  bookingIdFromTabbyReference,
  isTabbyPaymentAuthorized,
} from "@/lib/tabby/mark-paid";

export const dynamic = "force-dynamic";

/**
 * استقبال إشعارات تابي (Webhooks).
 */
export async function POST(req: Request) {
  if (!isTabbyConfigured()) {
    return NextResponse.json({ error: "Tabby gateway not configured" }, { status: 503 });
  }

  let event: {
    id?: string;
    payment_id?: string;
    order?: { reference_id?: string };
    reference_id?: string;
  };

  try {
    event = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const paymentId = String(event.id || event.payment_id || "").trim();
  if (!paymentId) {
    return NextResponse.json({ error: "missing payment id" }, { status: 400 });
  }

  let payment;
  try {
    payment = await fetchTabbyPayment(paymentId);
  } catch (e) {
    console.error("[tabby-webhook] payment verification failed:", e);
    return NextResponse.json({ error: "verification failed" }, { status: 500 });
  }

  const bookingId = bookingIdFromTabbyReference(payment.orderReferenceId);
  if (!bookingId) {
    console.warn(`[tabby-webhook] unknown reference for payment ${paymentId}`);
    return NextResponse.json({ received: true, ignored: "unknown reference" });
  }

  if (!isTabbyPaymentAuthorized(payment)) {
    return NextResponse.json({ received: true, status: payment.status });
  }

  // تابي تُطلق إشعاراً عند الاسترداد أيضاً والدفعة تبقى `CLOSED` — فبدون هذا الشرط
  // يُقرأ إشعار الاسترداد كتأكيد دفع جديد. (الحارس في mark-paid طبقة ثانية.)
  if (payment.refundedAmount > 0) {
    return NextResponse.json({ received: true, ignored: "payment has refunds" });
  }

  await applyAuthorizedTabbyPaymentToBooking(bookingId, payment, "webhook");

  return NextResponse.json({ received: true });
}
