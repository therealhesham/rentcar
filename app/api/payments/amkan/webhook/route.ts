import { NextResponse } from "next/server";
import { fetchAmkanOrderStatus, isAmkanConfigured, isAmkanOrderCompleted } from "@/lib/amkan/client";
import { applyCompletedAmkanOrderToBooking, bookingIdFromAmkanReference } from "@/lib/amkan/mark-paid";

export const dynamic = "force-dynamic";

/**
 * Merchant Notifier من إمكان (يصل بعد اكتمال الدفعة الأولى، أو إلغاء/استرداد).
 * لا نثق بجسم الإشعار (لا يوجد توقيع موثّق في المواصفة): نأخذ منه orderCode
 * (معرّف إمكان) فقط، ثم نستعلم حالة الطلب من API إمكان مباشرةً (Basic Auth)
 * ونعتمدها كمصدر الحقيقة — إشعار مزوّر لا يقابله طلب COMPLETED حقيقي لن يغيّر شيئاً.
 */
export async function POST(req: Request) {
  if (!isAmkanConfigured()) {
    return NextResponse.json({ error: "gateway not configured" }, { status: 503 });
  }

  let event: { orderCode?: string; merchantOrderCode?: string; eventCode?: string };
  try {
    event = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const gatewayOrderId = String(event.orderCode ?? "").trim();
  const ourOrderId = String(event.merchantOrderCode ?? "").trim();
  if (!gatewayOrderId || !ourOrderId) {
    return NextResponse.json({ error: "missing orderCode/merchantOrderCode" }, { status: 400 });
  }

  const bookingId = bookingIdFromAmkanReference(ourOrderId);
  if (!bookingId) {
    console.warn(`[amkan-webhook] unknown reference for order ${gatewayOrderId}`);
    return NextResponse.json({ received: true, ignored: "unknown reference" });
  }

  let order;
  try {
    order = await fetchAmkanOrderStatus(gatewayOrderId);
  } catch (e) {
    console.error("[amkan-webhook] order verification failed:", e);
    // 500 حتى تعيد إمكان الإرسال لاحقاً (قد يكون خللاً مؤقتاً في الشبكة)
    return NextResponse.json({ error: "verification failed" }, { status: 500 });
  }

  if (!isAmkanOrderCompleted(order)) {
    // رفض/انتظار/إلغاء/استرداد — لا تغيير محلي على حالة الدفع هنا
    return NextResponse.json({ received: true, status: order.statusCode });
  }

  await applyCompletedAmkanOrderToBooking(bookingId, gatewayOrderId, ourOrderId, "webhook");

  return NextResponse.json({ received: true });
}
