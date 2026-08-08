import { NextRequest, NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { isSpacesConfigured, uploadFileBufferToSpaces } from "@/lib/spaces-upload";
import {
  formatFileSize,
  SYSTEM_GUIDE_FOLDER_SLUG,
  SYSTEM_GUIDE_MAX_BYTES,
  systemGuideFileMeta,
} from "@/lib/system-guides";

/**
 * رفع ملف شرح إلى Spaces وإنشاء سجل الشرح. route handler وليس server action لأن ملفات
 * الفيديو تتجاوز حدّ حجم جسم الـ server action الافتراضي (1 ميجابايت).
 *
 * ملاحظة: مسارات /api لا يمرّ عليها middleware — فحص مدير النظام هنا هو الحاجز الوحيد.
 */
export async function POST(req: NextRequest) {
  const session = await getAdminSession();
  if (!session) {
    return NextResponse.json({ error: "غير مصرّح." }, { status: 401 });
  }
  if (!session.isSuperAdmin) {
    return NextResponse.json(
      { error: "رفع الشروحات متاح لمدير النظام فقط." },
      { status: 403 },
    );
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
    return NextResponse.json({ error: "اختر ملفاً للرفع." }, { status: 400 });
  }

  const title = String(formData.get("title") ?? "").trim();
  if (!title) {
    return NextResponse.json({ error: "عنوان الشرح مطلوب." }, { status: 400 });
  }
  const description = String(formData.get("description") ?? "").trim() || null;
  const sortOrderRaw = Number.parseInt(String(formData.get("sortOrder") ?? ""), 10);
  const sortOrder = Number.isFinite(sortOrderRaw) ? sortOrderRaw : 0;

  const sectionId = Number.parseInt(String(formData.get("sectionId") ?? ""), 10);
  if (!Number.isInteger(sectionId) || sectionId < 1) {
    return NextResponse.json({ error: "اختر القسم." }, { status: 400 });
  }
  const section = await prisma.systemGuideSection.findUnique({
    where: { id: sectionId },
    select: { id: true },
  });
  if (!section) {
    return NextResponse.json({ error: "القسم غير موجود." }, { status: 404 });
  }

  const meta = systemGuideFileMeta(file.type);
  if (!meta) {
    return NextResponse.json(
      { error: "نوع الملف غير مدعوم (فيديو MP4/WebM/MOV، صورة، أو PDF)." },
      { status: 400 },
    );
  }
  const maxBytes = SYSTEM_GUIDE_MAX_BYTES[meta.kind];
  if (file.size > maxBytes) {
    return NextResponse.json(
      { error: `حجم الملف يتجاوز الحد المسموح (${formatFileSize(maxBytes)}).` },
      { status: 400 },
    );
  }

  let uploaded: { key: string; url: string };
  try {
    uploaded = await uploadFileBufferToSpaces(Buffer.from(await file.arrayBuffer()), {
      folderSlug: SYSTEM_GUIDE_FOLDER_SLUG,
      mime: file.type,
      ext: meta.ext,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "فشل رفع الملف.";
    console.error(e);
    return NextResponse.json({ error: msg }, { status: 500 });
  }

  const guide = await prisma.systemGuide.create({
    data: {
      sectionId,
      title: title.slice(0, 255),
      description,
      kind: meta.kind,
      fileUrl: uploaded.url,
      fileKey: uploaded.key,
      originalFileName: file.name.slice(0, 255),
      mimeType: file.type.slice(0, 128),
      sizeBytes: file.size,
      sortOrder,
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, id: guide.id });
}
