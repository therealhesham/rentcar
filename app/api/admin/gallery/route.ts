import { NextRequest, NextResponse } from "next/server";
import { verifyAdminSession } from "@/lib/admin-auth";
import {
  galleryFolderExists,
  isValidGalleryFolderSlug,
  listGalleryFoldersForApi,
  requireGalleryFolderSlug,
} from "@/lib/gallery-folder";
import { isSpacesConfigured, listImagesInFolder, uploadImageToSpaces } from "@/lib/spaces-upload";

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

  const folderParam = req.nextUrl.searchParams.get("folder");
  const cursor = req.nextUrl.searchParams.get("cursor") ?? undefined;

  if (!folderParam) {
    try {
      const rows = await listGalleryFoldersForApi();
      const folders = rows.map((r) => ({ id: r.slug, label: r.label }));
      return NextResponse.json({ folders });
    } catch (e) {
      console.error(e);
      return NextResponse.json(
        {
          error:
            "تعذّر قراءة مجلدات المعرض. تأكد من إنشاء جدول GalleryFolder ومزامنة Prisma.",
        },
        { status: 500 },
      );
    }
  }

  const slug = folderParam.trim();
  if (!isValidGalleryFolderSlug(slug)) {
    return NextResponse.json({ error: "معرّف المجلد غير صالح." }, { status: 400 });
  }
  if (!(await galleryFolderExists(slug))) {
    return NextResponse.json({ error: "المجلد غير موجود." }, { status: 404 });
  }

  try {
    const data = await listImagesInFolder(slug, cursor);
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

  const folderRaw = String(formData.get("folder") ?? "").trim();
  if (!isValidGalleryFolderSlug(folderRaw)) {
    return NextResponse.json({ error: "مجلد الرفع غير صالح." }, { status: 400 });
  }

  try {
    await requireGalleryFolderSlug(folderRaw);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "المجلد غير معرّف.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  try {
    const url = await uploadImageToSpaces(file, folderRaw);
    return NextResponse.json({ url });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "فشل الرفع.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
