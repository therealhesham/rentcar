import { NextResponse } from "next/server";
import { currentRequestMeta, logActivity } from "@/lib/activity-log";
import { setCustomerSessionCookie } from "@/lib/customer-auth";
import { verifyAndConsumeCustomerLoginOtp } from "@/lib/customer-login-otp";

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
  const otp = String(o.otp ?? "").trim();

  const verified = await verifyAndConsumeCustomerLoginOtp({
    rawIdentifier: identifier,
    codeRaw: otp,
  });
  if (!verified.ok) {
    return NextResponse.json({ ok: false, error: verified.error }, { status: 400 });
  }

  await setCustomerSessionCookie(verified.userId);
  const meta = await currentRequestMeta();
  await logActivity({
    kind: "CUSTOMER_LOGIN",
    userId: verified.userId,
    actorLabel: identifier,
    ...meta,
  });
  return NextResponse.json({ ok: true });
}
