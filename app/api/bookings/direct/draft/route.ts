import { NextResponse } from "next/server";
import { getCustomerSessionUserId } from "@/lib/customer-auth";
import { createFleetBookingAndLinkCustomerSession } from "@/lib/fleet-checkout-customer-session";
import {
  isBookingCheckoutOtpStepRequired,
  sendBookingCheckoutOtpFromPublicRequest,
} from "@/lib/booking-checkout-otp";
import { parseCreateDirectBookingInputFromCheckoutJson } from "@/lib/booking-direct-checkout-parse";
import { assertBranchesAndPickupHoursForDirectBooking } from "@/lib/direct-booking";
import { e164ToLocalNine } from "@/lib/normalize-saudi-phone";
import {
  BOOKING_CHECKOUT_DRAFT_TTL_MS,
  deleteBookingCheckoutDraftByToken,
  newBookingCheckoutDraftToken,
  saveBookingCheckoutDraft,
} from "@/lib/booking-checkout-draft";
import { revalidateAfterDirectBooking } from "@/lib/revalidate-after-direct-booking";
import { isDirectBookingCapacityMessage } from "@/lib/direct-booking-user-messages";

export const dynamic = "force-dynamic";

function stripOtpFieldsFromBody(obj: Record<string, unknown>): Record<string, unknown> {
  const { phoneOtp: _p, otp: _o, ...rest } = obj;
  return rest;
}

/**
 * إنشاء حجز مباشر فوراً إن لم يُطلَب OTP، أو حفظ مسودة وإرسال الرمز ثم المتابعة من صفحة `/fleet/checkout/otp`.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "جسم الطلب ليس JSON صالحاً." }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "جسم الطلب فارغ." }, { status: 400 });
  }

  const obj = body as Record<string, unknown>;
  const sessionUserId = await getCustomerSessionUserId();
  const parsed = parseCreateDirectBookingInputFromCheckoutJson(obj, sessionUserId);
  if (!parsed.ok) {
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  const branchHours = await assertBranchesAndPickupHoursForDirectBooking(parsed.input);
  if (!branchHours.ok) {
    return NextResponse.json({ ok: false, error: branchHours.error }, { status: 400 });
  }

  const otpRequired = await isBookingCheckoutOtpStepRequired();
  if (!otpRequired) {
    const created = await createFleetBookingAndLinkCustomerSession(parsed.input);
    if (!created.ok) {
      const status = isDirectBookingCapacityMessage(created.error) ? 409 : 400;
      return NextResponse.json({ ok: false, error: created.error }, { status });
    }
    revalidateAfterDirectBooking();
    return NextResponse.json({ ok: true, bookingRequestId: created.bookingRequestId });
  }

  const token = newBookingCheckoutDraftToken();
  const expiresAt = new Date(Date.now() + BOOKING_CHECKOUT_DRAFT_TTL_MS);
  const payloadJson = JSON.stringify({ v: 1 as const, body: stripOtpFieldsFromBody(obj) });

  try {
    await saveBookingCheckoutDraft({ token, payloadJson, expiresAt });
  } catch (e) {
    console.error("booking checkout draft create failed", e);
    return NextResponse.json(
      { ok: false, error: "تعذّر حفظ بيانات الإتمام مؤقتاً. أعد المحاولة." },
      { status: 500 },
    );
  }

  const localPhone = e164ToLocalNine(parsed.input.phone);
  if (!localPhone) {
    await deleteBookingCheckoutDraftByToken(token);
    return NextResponse.json({ ok: false, error: "رقم الجوال غير صالح." }, { status: 400 });
  }

  const send = await sendBookingCheckoutOtpFromPublicRequest({
    phone: localPhone,
    email: parsed.input.contactEmail ?? undefined,
  });
  if (!send.ok) {
    await deleteBookingCheckoutDraftByToken(token);
    const status = send.retryAfterSec != null ? 429 : 400;
    return NextResponse.json(
      {
        ok: false,
        error: send.error,
        ...(send.retryAfterSec != null ? { retryAfterSec: send.retryAfterSec } : {}),
      },
      { status },
    );
  }

  return NextResponse.json({ ok: true, draftToken: token });
}
