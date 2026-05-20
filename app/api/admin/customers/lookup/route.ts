import { NextRequest, NextResponse } from "next/server";
import { lookupAdminCustomerByPhone } from "@/lib/admin-customer-phone-lookup";
import { getAdminSession } from "@/lib/admin-auth";

export async function GET(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ ok: false, error: "غير مصرّح." }, { status: 401 });
  }

  const localNine = req.nextUrl.searchParams.get("phone")?.replace(/\D/g, "").trim() ?? "";
  if (!/^5\d{8}$/.test(localNine)) {
    return NextResponse.json({ ok: false, error: "أدخل 9 أرقام تبدأ بـ 5." }, { status: 400 });
  }

  const result = await lookupAdminCustomerByPhone(localNine);
  if (!result.ok) {
    return NextResponse.json({ ok: false, error: result.error }, { status: 400 });
  }

  if (!result.data) {
    return NextResponse.json({ ok: true, found: false, phoneLocal: localNine });
  }

  const { found: _f, ...payload } = result.data;
  return NextResponse.json({ ok: true, found: true, ...payload });
}
