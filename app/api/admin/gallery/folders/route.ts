import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { createGalleryFolder } from "@/lib/gallery-folder";

export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session?.isSuperAdmin) {
    return NextResponse.json({ error: "غير مصرّح." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }

  const o = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const label = typeof o.label === "string" ? o.label : "";

  const result = await createGalleryFolder({ label });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
