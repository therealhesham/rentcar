import { NextResponse } from "next/server";
import { getCustomerSessionUserId } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";
import { readSubscriptionRelativeFile } from "@/lib/subscriptions/upload-file";

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

/** تنزيل ملف وثيقة — يتطلّب جلسة العميل وتطابق المالك. */
export async function GET(
  _: Request,
  ctx: { params: Promise<{ id: string; docId: string }> },
) {
  const uid = await getCustomerSessionUserId();
  if (!uid) return bad("غير مصرّح.", 401);
  const { id, docId } = await ctx.params;
  const sid = Number(id);
  const did = Number(docId);
  if (!Number.isInteger(sid) || !Number.isInteger(did)) return bad("معرّف غير صالح.");

  const doc = await prisma.subscriptionDocument.findFirst({
    where: { id: did, subscriptionId: sid, subscription: { userId: uid } },
  });
  if (!doc) return bad("الوثيقة غير موجودة.", 404);

  try {
    const buf = await readSubscriptionRelativeFile(doc.storageRelativePath);
    return new NextResponse(Buffer.from(buf), {
      headers: {
        "Content-Type": doc.mimeType,
        "Content-Disposition": `attachment; filename="${encodeURIComponent(doc.originalFileName)}"`,
      },
    });
  } catch {
    return bad("تعذّر قراءة الملف.", 500);
  }
}
