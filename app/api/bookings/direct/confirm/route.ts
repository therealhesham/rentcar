import { NextResponse } from "next/server";
import { createDirectBooking } from "@/lib/direct-booking";
import { getCustomerSessionUserId } from "@/lib/customer-auth";
import { verifyAndConsumeBookingCheckoutOtp } from "@/lib/booking-checkout-otp";
import { parseCreateDirectBookingInputFromCheckoutJson } from "@/lib/booking-direct-checkout-parse";
import { e164ToLocalNine } from "@/lib/normalize-saudi-phone";
import {
  deleteBookingCheckoutDraftByToken,
  getBookingCheckoutDraftByToken,
} from "@/lib/booking-checkout-draft";
import { revalidateAfterDirectBooking } from "@/lib/revalidate-after-direct-booking";

export const dynamic = "force-dynamic";

type DraftPayloadV1 = { v: 1; body: Record<string, unknown> };

function parseDraftPayload(json: string): DraftPayloadV1 | null {
  try {
    const raw = JSON.parse(json) as unknown;
    if (!raw || typeof raw !== "object") return null;
    const o = raw as Record<string, unknown>;
    if (o.v !== 1) return null;
    const b = o.body;
    if (!b || typeof b !== "object") return null;
    return { v: 1, body: b as Record<string, unknown> };
  } catch {
    return null;
  }
}

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

  const payload = parseDraftPayload(draft.payloadJson);
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

  const created = await createDirectBooking(parsed.input);
  if (!created.ok) {
    return NextResponse.json({ ok: false, error: created.error }, { status: 409 });
  }

  await deleteBookingCheckoutDraftByToken(token);
  revalidateAfterDirectBooking();

  return NextResponse.json({ ok: true, bookingRequestId: created.bookingRequestId });
}
