import { NextResponse } from "next/server";
import { getCustomerSessionUserId } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";
import { addLocalCalendarMonths } from "@/lib/booking-search-shared";

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

/** تأكيد دفع (تجريبي). يطبِّق تجديد تقويمي عند وجود معاملة RENEWAL:*. الطلب الأساسي يبقى PENDING حتى موافقة الإدارة. */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const uid = await getCustomerSessionUserId();
  if (!uid) return bad("غير مصرّح.", 401);
  const { id } = await ctx.params;
  const sid = Number(id);
  if (!Number.isInteger(sid) || sid < 1) return bad("معرف غير صالح.");

  let body: { paymentMethod?: string };
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const sub = await prisma.userSubscription.findFirst({
    where: { id: sid, userId: uid },
    include: {
      payments: {
        where: { status: "PENDING" },
        orderBy: { createdAt: "desc" },
        take: 1,
      },
      plan: true,
    },
  });
  if (!sub) return bad("الاشتراك غير موجود.", 404);

  const pendingPay = sub.payments[0];
  if (!pendingPay) return bad("لا توجد فاتورة بانتظار الدفع.");

  await prisma.$transaction(async (tx) => {
    await tx.subscriptionPayment.update({
      where: { id: pendingPay.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
        paymentMethod: body.paymentMethod?.trim().slice(0, 24) || "CARD_MOCK",
      },
    });

    const renewal = /^RENEWAL:(\d+)$/.exec(pendingPay.paymentKind);
    if (renewal) {
      const addMonthsNum = Number(renewal[1]);
      const now = new Date();
      const baseEnd = sub.endAt && sub.endAt > now ? sub.endAt : now;

      const newEnd = addLocalCalendarMonths(baseEnd, addMonthsNum);
      const extraAllowance =
        sub.plan.mileageKmPerMonth * addMonthsNum;

      await tx.userSubscription.update({
        where: { id: sid },
        data: {
          endAt: newEnd,
          status: "ACTIVE",
          mileageAllowanceKm: sub.mileageAllowanceKm + extraAllowance,
          nextPaymentDueAt: null,
          unpaidNotifiedAt: null,
          suspendedReasonAr: null,
        },
      });
    }
  });

  return NextResponse.json({ ok: true, paymentId: pendingPay.id, status: "PAID" });
}
