import { NextResponse } from "next/server";
import { isSpacesConfigured, uploadImageToSpaces } from "@/lib/spaces-upload";

export const dynamic = "force-dynamic";

/** رفع صورة مستندات الحجز (هوية/جواز أو رخصة) إلى DigitalOcean Spaces — مجلد booking-kyc */
export async function POST(request: Request) {
  if (!isSpacesConfigured()) {
    return NextResponse.json(
      { ok: false, error: "لم يُضبط تخزين الملفات (Spaces)." },
      { status: 503 },
    );
  }

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ ok: false, error: "جسم الطلب غير صالح." }, { status: 400 });
  }

  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ ok: false, error: "اختر ملف صورة صالحاً." }, { status: 400 });
  }

  try {
    const url = await uploadImageToSpaces(file, "booking-kyc");
    return NextResponse.json({ ok: true, url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "تعذّر رفع الملف.";
    return NextResponse.json({ ok: false, error: msg }, { status: 400 });
  }
}
