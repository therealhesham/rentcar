import { NextResponse } from "next/server";
import { fetchGeideaOrder, isGeideaConfigured } from "@/lib/geidea/client";
import {
  applyPaidGeideaOrderToBooking,
  bookingIdFromGeideaReference,
  isGeideaOrderPaid,
} from "@/lib/geidea/mark-paid";

export const dynamic = "force-dynamic";

/**
 * إشعار جيديا بعد الدفع (callbackUrl). لا نثق بجسم الإشعار إطلاقاً:
 * نأخذ منه orderId فقط، ثم نجلب حالة الطلب من API جيديا مباشرةً (Basic Auth)
 * ونعتمدها كمصدر الحقيقة — إشعار مزوّر بلا طلب حقيقي مدفوع لن يغيّر شيئاً.
 */
export async function POST(req: Request) {
  if (!isGeideaConfigured()) {
    return NextResponse.json({ error: "gateway not configured" }, { status: 503 });
  }

  let event: { order?: { orderId?: string }; orderId?: string };
  try {
    event = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const orderId = String(event.order?.orderId ?? event.orderId ?? "").trim();
  if (!orderId) {
    return NextResponse.json({ error: "missing orderId" }, { status: 400 });
  }

  let order;
  try {
    order = await fetchGeideaOrder(orderId);
  } catch (e) {
    console.error("[geidea-webhook] order verification failed:", e);
    // 500 حتى تعيد جيديا الإرسال لاحقاً (قد يكون خللاً مؤقتاً في الشبكة)
    return NextResponse.json({ error: "verification failed" }, { status: 500 });
  }

  const bookingId = bookingIdFromGeideaReference(order.merchantReferenceId);
  if (!bookingId) {
    console.warn(`[geidea-webhook] unknown reference for order ${orderId}`);
    return NextResponse.json({ received: true, ignored: "unknown reference" });
  }

  if (!isGeideaOrderPaid(order)) {
    // حالات فشل/انتظار — لا تغيير محلي؛ العميل يمكنه إعادة المحاولة من صفحة الدفع
    return NextResponse.json({ received: true, status: order.detailedStatus });
  }

  await applyPaidGeideaOrderToBooking(bookingId, order, "webhook");

  return NextResponse.json({ received: true });
}
