import { NextResponse } from "next/server";
import { getBookingOtpChannel } from "@/lib/site-settings";
import { parseCreateDirectBookingInputFromCheckoutJson } from "@/lib/booking-direct-checkout-parse";
import { e164ToLocalNine } from "@/lib/normalize-saudi-phone";
import { getBookingCheckoutDraftByToken } from "@/lib/booking-checkout-draft";

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

function maskEmailHint(email: string): string {
  const lower = email.trim().toLowerCase();
  const [u, d] = lower.split("@");
  if (!d) return "•••";
  const head = u.length <= 2 ? `${u.slice(0, 1)}•` : `${u.slice(0, 2)}•••`;
  return `${head}@${d}`;
}

function maskPhoneHint(localNine: string): string {
  if (!/^5\d{8}$/.test(localNine)) return "•••";
  return `•••••${localNine.slice(-2)}`;
}

/** بيانات عرض لصفحة OTP (بدون تسريب كامل للبريد/الجوال). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = String(url.searchParams.get("token") ?? "").trim();
  if (!/^[a-f0-9]{64}$/i.test(token)) {
    return NextResponse.json({ ok: false, error: "رمز الجلسة غير صالح." }, { status: 400 });
  }

  const draft = await getBookingCheckoutDraftByToken(token);
  if (!draft || draft.expiresAt.getTime() < Date.now()) {
    return NextResponse.json(
      { ok: false, error: "انتهت صلاحية هذه الخطوة. ارجع إلى صفحة الإتمام." },
      { status: 404 },
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

  const channel = await getBookingOtpChannel();
  const localPhone = e164ToLocalNine(parsed.input.phone);
  const email = (parsed.input.contactEmail ?? "").trim().toLowerCase();

  const destinationHint =
    channel === "EMAIL"
      ? maskEmailHint(email)
      : localPhone
        ? maskPhoneHint(localPhone)
        : "•••";

  return NextResponse.json({
    ok: true,
    channel,
    destinationHint,
    expiresAt: draft.expiresAt.toISOString(),
  });
}
