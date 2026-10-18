import { NextResponse } from "next/server";
import { isBookingCheckoutOtpStepRequired } from "@/lib/booking-checkout-otp";
import { isCustomerLoginOtpStepRequired } from "@/lib/customer-login-otp";
import { getBookingOtpChannel, getLoginOtpChannel } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

/**
 * إعدادات رمز التحقق الحالية (للواجهة).
 * `?flow=login` لصفحة دخول العميل، وبدونه إعداد إتمام الحجز.
 */
export async function GET(req: Request) {
  const flow = new URL(req.url).searchParams.get("flow");
  const [channel, required] =
    flow === "login"
      ? await Promise.all([getLoginOtpChannel(), isCustomerLoginOtpStepRequired()])
      : await Promise.all([getBookingOtpChannel(), isBookingCheckoutOtpStepRequired()]);
  return NextResponse.json({ ok: true, channel, required });
}
