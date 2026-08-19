import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { alertAbandonedOtpCheckoutDrafts } from "@/lib/otp-abandon-alert";

/** فحص دوري: عملاء طلبوا رمز تحقق إتمام حجز ولم يكملوا خلال 5 دقائق — تنبيه واتساب للمطوّر. اتصل بجدولة خارجية كل 5 دقائق تقريباً. */
export async function POST(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ ok: false, error: "CRON_SECRET_NOT_SET" }, { status: 501 });
  }

  const auth = req.headers.get("authorization") ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7).trim() : "";
  const a = Buffer.from(token, "utf8");
  const b = Buffer.from(cronSecret, "utf8");
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  const result = await alertAbandonedOtpCheckoutDrafts();

  return NextResponse.json({ ok: true, ...result });
}
