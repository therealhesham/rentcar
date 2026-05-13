import { NextResponse } from "next/server";
import { sendBookingCheckoutOtpFromPublicRequest } from "@/lib/booking-checkout-otp";
import { getBookingCheckoutDraftByToken } from "@/lib/booking-checkout-draft";
import { parseCreateDirectBookingInputFromCheckoutJson } from "@/lib/booking-direct-checkout-parse";
import { e164ToLocalNine } from "@/lib/normalize-saudi-phone";

export const dynamic = "force-dynamic";

type DraftPayloadV1 = { v: 1; body: Record<string, unknown> };

function parseDraftPayload(json: string): DraftPayloadV1 | null {
  try {
    const raw = JSON.parse(json) as unknown;
    if (!raw || typeof raw !== "object") return null;
    const rec = raw as Record<string, unknown>;
    if (rec.v !== 1) return null;
    const b = rec.body;
    if (!b || typeof b !== "object") return null;
    return { v: 1, body: b as Record<string, unknown> };
  } catch {
    return null;
  }
}

/** طلب إرسال رمز التحقق (SMS أو بريد حسب إعداد الإدارة). */
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
  const draftToken = String(o.draftToken ?? "").trim();

  let phone: string | undefined;
  let email: string | undefined;

  if (draftToken) {
    if (!/^[a-f0-9]{64}$/i.test(draftToken)) {
      return NextResponse.json({ ok: false, error: "رمز الجلسة غير صالح." }, { status: 400 });
    }
    const draft = await getBookingCheckoutDraftByToken(draftToken);
    if (!draft || draft.expiresAt.getTime() < Date.now()) {
      return NextResponse.json(
        { ok: false, error: "انتهت صلاحية جلسة التحقق. ارجع إلى صفحة الإتمام." },
        { status: 400 },
      );
    }
    const payload = parseDraftPayload(draft.payloadJson);
    if (!payload) {
      return NextResponse.json({ ok: false, error: "بيانات المسودة غير صالحة." }, { status: 400 });
    }
    const parsed = parseCreateDirectBookingInputFromCheckoutJson(payload.body, null);
    if (!parsed.ok) {
      return NextResponse.json({ ok: false, error: "بيانات المسودة غير صالحة." }, { status: 400 });
    }
    const local = e164ToLocalNine(parsed.input.phone);
    if (!local) {
      return NextResponse.json({ ok: false, error: "رقم الجوال غير صالح في المسودة." }, { status: 400 });
    }
    phone = local;
    email = parsed.input.contactEmail ?? undefined;
  } else {
    phone = typeof o.phone === "string" ? o.phone : undefined;
    email = typeof o.email === "string" ? o.email : undefined;
  }

  const result = await sendBookingCheckoutOtpFromPublicRequest({
    phone,
    email,
  });
  if (!result.ok) {
    const status = result.retryAfterSec != null ? 429 : 400;
    return NextResponse.json(
      {
        ok: false,
        error: result.error,
        ...(result.retryAfterSec != null ? { retryAfterSec: result.retryAfterSec } : {}),
      },
      { status },
    );
  }
  return NextResponse.json({ ok: true });
}
