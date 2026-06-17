import { NextResponse } from "next/server";
import { parseAdminSessionToken } from "@/lib/admin-auth";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return NextResponse.json({ ok: false, error: "No token" }, { status: 401 });
  }

  try {
    const session = await parseAdminSessionToken(token);
    if (!session) {
      return NextResponse.json({ ok: false, error: "Invalid token" }, { status: 401 });
    }

    return NextResponse.json({
      ok: true,
      employeeId: session.employeeId,
      branchId: session.branchId,
      isSuperAdmin: session.isSuperAdmin,
    });
  } catch (error) {
    return NextResponse.json({ ok: false, error: "Auth failed" }, { status: 401 });
  }
}
