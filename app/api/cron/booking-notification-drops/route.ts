import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { sweepDroppedBookingNotifications } from "@/lib/booking-notification-drops";

/** فحص دوري: يرسل إشعار الموظفين على أي حجز خلال آخر ٢٤ ساعة لم يصله إشعار بعد (عادة عميل سايب صفحة الدفع). اتصل بجدولة خارجية كل ١٠-١٥ دقيقة تقريباً. */
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

  const result = await sweepDroppedBookingNotifications();

  return NextResponse.json({ ok: true, ...result });
}
