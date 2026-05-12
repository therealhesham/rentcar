import { NextResponse } from "next/server";
import { SubscriptionDocumentKind } from "@prisma/client";
import { getCustomerSessionUserId } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";
import { saveSubscriptionUpload } from "@/lib/subscriptions/upload-file";

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

const DOC_KINDS: SubscriptionDocumentKind[] = [
  SubscriptionDocumentKind.DRIVERS_LICENSE,
  SubscriptionDocumentKind.NATIONAL_ID,
  SubscriptionDocumentKind.OTHER,
];

function parseKind(raw: string): SubscriptionDocumentKind | null {
  return DOC_KINDS.includes(raw as SubscriptionDocumentKind)
    ? (raw as SubscriptionDocumentKind)
    : null;
}

/** رفع وثيقة (رخصة / هوية). multipart: kind + file */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const uid = await getCustomerSessionUserId();
  if (!uid) return bad("غير مصرّح.", 401);
  const { id } = await ctx.params;
  const sid = Number(id);
  if (!Number.isInteger(sid) || sid < 1) return bad("معرف غير صالح.");

  const sub = await prisma.userSubscription.findFirst({
    where: { id: sid, userId: uid },
  });
  if (!sub) return bad("الاشتراك غير موجود.", 404);
  if (!["PENDING", "ACTIVE", "SUSPENDED"].includes(sub.status)) {
    return bad("لا يمكن رفع وثائق لهذه الحالة.");
  }

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return bad("توقّع multipart/form-data.", 415);
  }

  const rawKind = String(formData.get("kind") ?? "").trim();
  const file = formData.get("file");
  const kind = parseKind(rawKind);
  if (!kind) {
    return bad("نوع الوثيقة غير صالح.");
  }
  if (!(file instanceof File)) return bad("الملف مطلوب.");

  const buf = Buffer.from(await file.arrayBuffer());
  try {
    const { relativePath } = await saveSubscriptionUpload({
      subscriptionId: sid,
      buf,
      originalName: file.name,
      mimeType: file.type || "application/octet-stream",
    });

    const existing = await prisma.subscriptionDocument.findUnique({
      where: { subscriptionId_kind: { subscriptionId: sid, kind } },
    });
    if (existing) {
      await prisma.subscriptionDocument.update({
        where: { id: existing.id },
        data: {
          storageRelativePath: relativePath,
          originalFileName: file.name.slice(0, 255),
          mimeType: file.type.slice(0, 128) || "application/octet-stream",
          sizeBytes: buf.byteLength,
          verifiedAt: null,
          uploadedAt: new Date(),
        },
      });
    } else {
      await prisma.subscriptionDocument.create({
        data: {
          subscriptionId: sid,
          kind,
          storageRelativePath: relativePath,
          originalFileName: file.name.slice(0, 255),
          mimeType: file.type.slice(0, 128) || "application/octet-stream",
          sizeBytes: buf.byteLength,
        },
      });
    }
  } catch (e: unknown) {
    const msg = String((e as Error)?.message ?? "");
    if (msg === "FILE_TOO_LARGE") return bad("حجم الملف كبير جداً.", 413);
    if (msg === "MIME_NOT_ALLOWED") return bad("صيغة الملف غير مسموحة.", 415);
    return bad("تعذّر حفظ الملف.", 500);
  }

  return NextResponse.json({ ok: true });
}
