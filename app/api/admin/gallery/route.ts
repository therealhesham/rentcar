import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-auth";
import {
  isSpacesConfigured,
  listGalleryImages,
  uploadImageToSpaces,
} from "@/lib/spaces-upload";

export async function GET(req: NextRequest) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "غير مصرّح." }, { status: 401 });
  }
  if (!isSpacesConfigured()) {
    return NextResponse.json(
      { error: "لم يُضبط تخزين Spaces في البيئة." },
      { status: 503 },
    );
  }
  const cursor = req.nextUrl.searchParams.get("cursor") ?? undefined;
  try {
    const data = await listGalleryImages(cursor ?? undefined);
    return NextResponse.json(data);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "فشل جلب المعرض.";
    console.error(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  if (!(await verifyAdminSession())) {
    return NextResponse.json({ error: "غير مصرّح." }, { status: 401 });
  }
  if (!isSpacesConfigured()) {
    return NextResponse.json(
      { error: "لم يُضبط تخزين Spaces في البيئة." },
      { status: 503 },
    );
  }
  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: "طلب غير صالح." }, { status: 400 });
  }
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: "لم يُرفع ملف." }, { status: 400 });
  }
  try {
    const url = await uploadImageToSpaces(file, "gallery");
    return NextResponse.json({ url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "فشل الرفع.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
