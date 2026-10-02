import { NextResponse } from "next/server";
import { fetchAmkanOrderStatus, isAmkanConfigured, isAmkanOrderCompleted } from "@/lib/amkan/client";
import {
  applyCompletedAmkanOrderToBooking,
  bookingIdFromAmkanReference,
  findAmkanBookingByGatewayRef,
} from "@/lib/amkan/mark-paid";

export const dynamic = "force-dynamic";

/**
 * Merchant Notifier من إمكان (يصل بعد اكتمال الدفعة الأولى، أو إلغاء/استرداد).
 *
 * لا نثق بجسم الإشعار (لا يوجد توقيع في المواصفة). نأخذ منه `orderCode` فقط، ثم:
 *  ١) نعثر على الحجز بما خزّناه نحن (`paymentGatewayRef`) لا بما يرسله الطرف الآخر —
 *     `merchantOrderCode` حقل اختياري في المواصفة، والاعتماد عليه يعني قبول اقتران
 *     يحدّده المُرسِل.
 *  ٢) نستعلم عن حالة الطلب من API إمكان (Basic Auth) ونعتمدها مصدر الحقيقة.
 * إشعار مزوّر لا يقابله طلب COMPLETED مقترن بحجز عندنا لن يغيّر شيئاً.
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
  if (!gatewayOrderId) {
    return NextResponse.json({ error: "missing orderCode" }, { status: 400 });
  }

  const booking = await findAmkanBookingByGatewayRef(gatewayOrderId);
  if (!booking) {
    console.warn(`[amkan-webhook] no booking holds amkan order ${gatewayOrderId}`);
    return NextResponse.json({ received: true, ignored: "unknown order" });
  }

  // فحص اتّساق فقط حين يرسل إمكان الحقل الاختياري: اختلافه عمّا لدينا يعني خللاً في
  // الإعداد يستحق الانتباه، لكنه لا يغيّر الحجز المستهدَف (المحدَّد أعلاه من بياناتنا).
  const claimed = bookingIdFromAmkanReference(String(event.merchantOrderCode ?? "").trim() || null);
  if (claimed != null && claimed !== booking.id) {
    console.error(
      `[amkan-webhook] merchantOrderCode points to booking ${claimed} but order ${gatewayOrderId} belongs to booking ${booking.id}`,
    );
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

  await applyCompletedAmkanOrderToBooking(
    booking.id,
    gatewayOrderId,
    booking.paymentSessionRef ?? "",
    "webhook",
  );

  return NextResponse.json({ received: true });
}
