import { NextResponse } from "next/server";
import { getCustomerSessionUserId } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

/** تفاصيل اشتراك لمالكه فقط — يستعمل في تطبيق الجوال أو أدوات بسيطة. */
export async function GET(
  _: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const uid = await getCustomerSessionUserId();
  if (!uid) return bad("غير مصرّح.", 401);

  const { id } = await ctx.params;
  const sid = Number(id);
  if (!Number.isInteger(sid)) return bad("معرّف غير صالح.");

  const row = await prisma.userSubscription.findFirst({
    where: { id: sid, userId: uid },
    include: {
      plan: { include: { carModel: { include: { brand: true } } } },
      payments: true,
      documents: true,
    },
  });
  if (!row) return bad("غير موجود.", 404);

  return NextResponse.json({ ok: true, subscription: row });
}
