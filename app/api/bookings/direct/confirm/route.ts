import { NextResponse } from "next/server";
import { getCustomerSessionUserId } from "@/lib/customer-auth";
import { createFleetBookingAndLinkCustomerSession } from "@/lib/fleet-checkout-customer-session";
import { verifyAndConsumeBookingCheckoutOtp } from "@/lib/booking-checkout-otp";
import { parseCreateDirectBookingInputFromCheckoutJson } from "@/lib/booking-direct-checkout-parse";
import { e164ToLocalNine } from "@/lib/normalize-saudi-phone";
import {
  deleteBookingCheckoutDraftByToken,
  getBookingCheckoutDraftByToken,
  parseBookingCheckoutDraftPayload,
} from "@/lib/booking-checkout-draft";
import { revalidateAfterDirectBooking } from "@/lib/revalidate-after-direct-booking";
import { isDirectBookingCapacityMessage } from "@/lib/direct-booking-user-messages";

export const dynamic = "force-dynamic";

/** بعد التحقق من OTP: إنشاء الحجز في قاعدة البيانات والانتقال للدفع. */
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

  const o = body as Record<string, unknown>;
  const token = String(o.draftToken ?? o.token ?? "").trim();
  const otpRaw = String(o.otp ?? o.phoneOtp ?? "").trim();

  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return NextResponse.json({ ok: false, error: "رابط التحقق غير صالح. ارجع إلى صفحة الإتمام." }, { status: 400 });
  }

  const draft = await getBookingCheckoutDraftByToken(token);
  if (!draft || draft.expiresAt.getTime() < Date.now()) {
    if (draft) {
      await deleteBookingCheckoutDraftByToken(token);
    }
    return NextResponse.json(
      { ok: false, error: "انتهت صلاحية جلسة التحقق. ارجع إلى صفحة الإتمام وأعد إرسال البيانات." },
      { status: 400 },
    );
  }

  const payload = parseBookingCheckoutDraftPayload(draft.payloadJson);
  if (!payload) {
    await deleteBookingCheckoutDraftByToken(token);
    return NextResponse.json({ ok: false, error: "بيانات المسودة تالفة. أعد المحاولة من صفحة الإتمام." }, { status: 400 });
  }

  const sessionUserId = await getCustomerSessionUserId();
  const parsed = parseCreateDirectBookingInputFromCheckoutJson(payload.body, sessionUserId);
  if (!parsed.ok) {
    await deleteBookingCheckoutDraftByToken(token);
    return NextResponse.json({ ok: false, error: parsed.error }, { status: 400 });
  }

  const localPhone = e164ToLocalNine(parsed.input.phone);
  if (!localPhone) {
    await deleteBookingCheckoutDraftByToken(token);
    return NextResponse.json({ ok: false, error: "رقم الجوال غير صالح." }, { status: 400 });
  }

  const verified = await verifyAndConsumeBookingCheckoutOtp({
    phoneLocalNine: localPhone,
    contactEmail: parsed.input.contactEmail ?? "",
    codeRaw: otpRaw,
  });
  if (!verified.ok) {
    return NextResponse.json({ ok: false, error: verified.error }, { status: 400 });
  }

  const created = await createFleetBookingAndLinkCustomerSession(parsed.input);
  if (!created.ok) {
    const status = isDirectBookingCapacityMessage(created.error) ? 409 : 400;
    return NextResponse.json({ ok: false, error: created.error }, { status });
  }

  await deleteBookingCheckoutDraftByToken(token);
  revalidateAfterDirectBooking();

  return NextResponse.json({ ok: true, bookingRequestId: created.bookingRequestId });
}
