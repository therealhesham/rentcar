import { NextResponse } from "next/server";
import { sendCustomerLoginOtpForIdentifier } from "@/lib/customer-login-otp";

export const dynamic = "force-dynamic";

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
  const identifier = String(o.identifier ?? o.email ?? o.phone ?? "").trim();
  const result = await sendCustomerLoginOtpForIdentifier(identifier);
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
