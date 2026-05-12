import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getCustomerSessionUserId } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";
import { addLocalCalendarMonths } from "@/lib/booking-search-shared";
import { isAllowedDuration } from "@/lib/subscriptions/duration-options";
import { subscriptionSubtotalExclVat, vatFromSubtotal } from "@/lib/subscriptions/pricing";

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

/** إنشاء دفعة تجديد PENDING — يطبِّق التمديد فعلياً عند تأكيد الدفع (انظر مسار الدفع). */
export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  const uid = await getCustomerSessionUserId();
  if (!uid) return bad("غير مصرّح.", 401);
  const { id } = await ctx.params;
  const sid = Number(id);
  if (!Number.isInteger(sid) || sid < 1) return bad("معرف غير صالح.");

  let body: { durationMonths?: number };
  try {
    body = await req.json();
  } catch {
    return bad("JSON غير صالح.");
  }
  const durationMonths = Number(body.durationMonths);

  const sub = await prisma.userSubscription.findFirst({
    where: { id: sid, userId: uid },
    include: {
      plan: true,
      payments: { where: { status: "PENDING", paymentKind: { startsWith: "RENEWAL" } }, take: 3 },
    },
  });
  if (!sub) return bad("الاشتراك غير موجود.", 404);
  if (!["ACTIVE"].includes(sub.status)) {
    return bad("التجديد متاح للاشتراك النشط فقط في هذا الإصدار.");
  }
  if (sub.payments.length > 0) {
    return bad("توجد عملية تجديد لم تُكمَل بعد.");
  }

  if (!Number.isInteger(durationMonths) || !isAllowedDuration(sub.plan.durationOptionsCsv, durationMonths)) {
    return bad("مدة التجديد غير مسموحة.");
  }

  const basePrice = sub.monthlyPriceSnapshotSar;

  /** التجديد: أشهر إضافية بدون العربون الأولي؛ يمكن تخصيصها لاحقاً. */
  const subtotalExcl = subscriptionSubtotalExclVat(basePrice, durationMonths, 0);
  const car = await prisma.carModel.findUnique({ where: { id: sub.plan.carModelId } });
  const vatPct = car?.vatRatePercent ?? 15;
  const vatAmt = vatFromSubtotal(subtotalExcl, vatPct);
  const totalIncl = subtotalExcl + vatAmt;

  const paymentKind = `RENEWAL:${durationMonths}`;

  const pay = await prisma.subscriptionPayment.create({
    data: {
      subscriptionId: sid,
      amountSar: totalIncl,
      vatRatePercent: vatPct,
      paymentKind,
      status: "PENDING",
      idempotencyKey: randomUUID(),
    },
  });

  return NextResponse.json({
    ok: true,
    paymentId: pay.id,
    renewalMonths: durationMonths,
    pricing: {
      subtotalExcludingVat: subtotalExcl,
      vatAmount: vatAmt,
      totalIncludingVat: totalIncl,
    },
  });
}
