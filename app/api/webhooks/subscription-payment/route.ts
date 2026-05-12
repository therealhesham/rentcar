import { timingSafeEqual, createHmac } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { addLocalCalendarMonths } from "@/lib/booking-search-shared";

/** Webhook خارجي لتأكيد دفع — يحمًّى بسرّ وبصمة توقّع بسيطة. */
export async function POST(req: Request) {
  const secret = process.env.SUBSCRIPTION_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json({ ok: false, error: "WEBHOOK_NOT_CONFIGURED" }, { status: 501 });
  }

  const raw = Buffer.from(await req.arrayBuffer());

  const sigHeader = req.headers.get("x-signature") ?? "";
  const expectedHex = createHmac("sha256", secret).update(raw).digest("hex");
  const gotHex = sigHeader.trim().toLowerCase().replace(/^sha256=/i, "");
  let okSig = false;
  try {
    const a = Buffer.from(gotHex, "hex");
    const b = Buffer.from(expectedHex, "hex");
    okSig = a.length === b.length && timingSafeEqual(a, b);
  } catch {
    okSig = false;
  }
  if (!okSig) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }

  let body: {
    subscriptionId?: number;
    paymentId?: number;
    externalRef?: string;
  };
  try {
    body = JSON.parse(raw.toString("utf8"));
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const sid = Number(body.subscriptionId);
  const pid = Number(body.paymentId);
  if (!Number.isInteger(sid) || !Number.isInteger(pid)) {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  const payment = await prisma.subscriptionPayment.findFirst({
    where: { id: pid, subscriptionId: sid },
  });
  if (!payment || payment.status === "PAID") {
    return NextResponse.json({ ok: false }, { status: 409 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.subscriptionPayment.update({
      where: { id: pid },
      data: {
        status: "PAID",
        paidAt: new Date(),
        externalRef: body.externalRef?.slice(0, 250) ?? "webhook",
        paymentMethod: "WEBHOOK",
      },
    });

    const renewal = /^RENEWAL:(\d+)$/.exec(payment.paymentKind);
    const subRow = await tx.userSubscription.findUnique({
      where: { id: sid },
      include: { plan: true },
    });

    if (renewal && subRow) {
      const addMonthsNum = Number(renewal[1]);
      const now = new Date();
      const baseEnd = subRow.endAt && subRow.endAt > now ? subRow.endAt : now;
      const newEnd = addLocalCalendarMonths(baseEnd, addMonthsNum);
      const extraAllowance =
        subRow.plan.mileageKmPerMonth * addMonthsNum;
      await tx.userSubscription.update({
        where: { id: sid },
        data: {
          endAt: newEnd,
          status: "ACTIVE",
          mileageAllowanceKm: subRow.mileageAllowanceKm + extraAllowance,
          nextPaymentDueAt: null,
          unpaidNotifiedAt: null,
          suspendedReasonAr: null,
        },
      });
    }
  });

  return NextResponse.json({ ok: true });
}
