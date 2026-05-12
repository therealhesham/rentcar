import { NextResponse } from "next/server";
import { getCustomerSessionUserId } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";
import { canCustomerCancel } from "@/lib/subscriptions/lifecycle";

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

/** إلغاء من طرف العميل (وفق سياسة مبسّطة للإصدار الحالي). */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const uid = await getCustomerSessionUserId();
  if (!uid) return bad("غير مصرّح.", 401);
  const { id } = await ctx.params;
  const sid = Number(id);
  if (!Number.isInteger(sid) || sid < 1) return bad("معرف غير صالح.");

  let body: { reason?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }
  const reason = String(body.reason ?? "").trim().slice(0, 500);

  const sub = await prisma.userSubscription.findFirst({
    where: { id: sid, userId: uid },
  });
  if (!sub) return bad("الاشتراك غير موجود.", 404);
  if (!canCustomerCancel(sub.status)) {
    return bad("لا يمكن إلغاء الاشتراك في هذه الحالة.");
  }

  await prisma.userSubscription.update({
    where: { id: sid },
    data: {
      status: "CANCELLED",
      cancelReasonAr: reason || "طلب إلغاء من العميل.",
      cancelledAt: new Date(),
    },
  });

  return NextResponse.json({ ok: true });
}
