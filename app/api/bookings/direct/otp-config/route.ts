import { NextResponse } from "next/server";
import { isBookingCheckoutOtpStepRequired } from "@/lib/booking-checkout-otp";
import { getBookingOtpChannel } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

/** إعدادات رمز التحقق الحالية (للواجهة — نفس منطق إنشاء الحجز). */
export async function GET() {
  const [channel, required] = await Promise.all([
    getBookingOtpChannel(),
    isBookingCheckoutOtpStepRequired(),
  ]);
  return NextResponse.json({ ok: true, channel, required });
}
