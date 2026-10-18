import { NextResponse } from "next/server";
import { handleIncomingRasayilyMessage } from "@/lib/whatsapp-chatbot";

export const dynamic = "force-dynamic";

/**
 * Webhook استقبال رسائل واتساب الواردة من رسائلي — نسجّل هذا الرابط في حقل
 * "رابط الـ Webhook الخاص بـ n8n" بإعدادات n8n عندهم. الحقل عام رغم اسمه ويقبل
 * أي endpoint HTTP، فمفيش داعٍ لاستخدام n8n فعلياً.
 *
 * الحماية: "رمز التحقق (Secret Token)" من نفس الإعدادات يصل في هيدر
 * X-N8n-Secret — لازم تحط نفس القيمة في RASAYILY_WEBHOOK_SECRET هنا وفي
 * الإعدادات هناك.
 *
 * رد الذكاء الاصطناعي بيترجع بشكل منفصل عبر POST /api/n8n-callback (راجع
 * lib/whatsapp-chatbot.ts)، مش في رد هذا الطلب — فبنرجّع 200 بعد المصادقة دايماً
 * منعاً لإعادة محاولات رسائلي على أخطاء داخلية.
 */
export async function POST(req: Request) {
  const expectedSecret = process.env.RASAYILY_WEBHOOK_SECRET?.trim();
  const gotSecret = req.headers.get("x-n8n-secret")?.trim();
  if (!expectedSecret || gotSecret !== expectedSecret) {
    console.warn("[rasayily-webhook] رفض الطلب — X-N8n-Secret غير مضبوط أو غير مطابق.");
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }
  console.info("[rasayily-webhook] raw payload:", JSON.stringify(raw));

  try {
    await handleIncomingRasayilyMessage(raw);
  } catch (e) {
    console.error("[rasayily-webhook] فشل معالجة الرسالة الواردة:", e);
  }

  return NextResponse.json({ received: true });
}
