import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { getCustomerSessionUserId } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";
import {
  isAllowedDuration,
  MAX_SUBSCRIPTION_DURATION_MONTHS,
  MIN_SUBSCRIPTION_DURATION_MONTHS,
} from "@/lib/subscriptions/duration-options";
import { subscriptionSubtotalExclVat, vatFromSubtotal } from "@/lib/subscriptions/pricing";
import { parseSubscriptionStartDateYmd } from "@/lib/subscriptions/start-date";

function bad(msg: string, status = 400) {
  return NextResponse.json({ ok: false, error: msg }, { status });
}

/** اشتراكي (النشطة والمعلقة) — عميل مسجّل فقط. */
export async function GET() {
  const uid = await getCustomerSessionUserId();
  if (!uid) return bad("غير مصرّح.", 401);

  const rows = await prisma.userSubscription.findMany({
    where: { userId: uid },
    orderBy: { createdAt: "desc" },
    take: 50,
    include: {
      plan: { include: { carModel: { include: { brand: true } } } },
      payments: { orderBy: { createdAt: "desc" }, take: 5 },
      documents: true,
    },
  });

  const now = Date.now();
  return NextResponse.json({
    ok: true,
    subscriptions: rows.map((s) => {
      const allowance = s.mileageAllowanceKm;
      const used = s.mileageUsedKm;
      const remainingDays =
        s.endAt && ["ACTIVE"].includes(s.status)
          ? Math.max(0, Math.ceil((s.endAt.getTime() - now) / (86400 * 1000)))
          : null;

      return {
        id: s.id,
        status: s.status,
        durationMonths: s.durationMonths,
        plannedStartDate: s.plannedStartDate,
        startAt: s.startAt,
        endAt: s.endAt,
        remainingDaysApprox: remainingDays,
        mileageUsedKm: used,
        mileageAllowanceKm: allowance,
        mileageRemainingKm: Math.max(0, allowance - used),
        autoRenew: s.autoRenew,
        plan: {
          slug: s.plan.slug,
          title:
            s.plan.marketingTitleAr ??
            `${s.plan.carModel.brand.name} ${s.plan.carModel.name}`,
          carImage: s.plan.carModel.image,
          monthlyPriceSnapshotSar: s.monthlyPriceSnapshotSar,
        },
        documents: s.documents.map((d) => ({
          kind: d.kind,
          uploadedAt: d.uploadedAt,
          verifiedAt: d.verifiedAt,
        })),
        lastPayments: s.payments.map((p) => ({
          id: p.id,
          amountSar: p.amountSar,
          status: p.status,
          kind: p.paymentKind,
          paidAt: p.paidAt,
        })),
      };
    }),
  });
}

/** إنشاء طلب اشتراك + سجل دفع أولية PENDING. */
export async function POST(req: Request) {
  const uid = await getCustomerSessionUserId();
  if (!uid) return bad("سجّل الدخول لإنشاء اشتراك.", 401);

  let body: { planSlug?: string; durationMonths?: number; autoRenew?: boolean; startDate?: string };
  try {
    body = await req.json();
  } catch {
    return bad("جسم طلب غير صالح JSON.");
  }

  const planSlug = String(body.planSlug ?? "")
    .trim()
    .toLowerCase();
  const durationMonths = Number(body.durationMonths);
  const autoRenew = Boolean(body.autoRenew);
  const startDateRaw = String(body.startDate ?? "").trim();

  if (!planSlug) return bad("planSlug مطلوب.");
  if (!startDateRaw) return bad("اختر يوم بدء الباقة.");
  if (
    !Number.isInteger(durationMonths) ||
    durationMonths < MIN_SUBSCRIPTION_DURATION_MONTHS ||
    durationMonths > MAX_SUBSCRIPTION_DURATION_MONTHS
  ) {
    return bad(
      `اختر مدة اشتراك صالحة بين ${MIN_SUBSCRIPTION_DURATION_MONTHS} و${MAX_SUBSCRIPTION_DURATION_MONTHS} شهراً.`,
    );
  }

  const startParsed = parseSubscriptionStartDateYmd(startDateRaw);
  if (!startParsed.ok) return bad(startParsed.error);

  const plan = await prisma.subscriptionPlan.findFirst({
    where: { slug: planSlug, isActive: true },
    include: { carModel: true },
  });
  if (!plan) return bad("الباقة غير متوفرة.");

  if (!isAllowedDuration(plan.durationOptionsCsv, durationMonths)) {
    return bad("مدة الباقة غير مسموحة لهذه الخطة.");
  }

  const mileageAllowanceKm = plan.mileageKmPerMonth * durationMonths;
  const depositSnapshotSar = plan.depositAmountSar;
  const subtotalExcl = subscriptionSubtotalExclVat(
    plan.monthlyPriceSar,
    durationMonths,
    depositSnapshotSar,
  );
  const vatPct = plan.carModel.vatRatePercent ?? 15;
  const vatAmt = vatFromSubtotal(subtotalExcl, vatPct);
  const chargeTotalIncl = subtotalExcl + vatAmt;

  const idempotencyKey = randomUUID();

  const created = await prisma.$transaction(async (tx) => {
    const sub = await tx.userSubscription.create({
      data: {
        planId: plan.id,
        userId: uid,
        status: "PENDING",
        durationMonths,
        plannedStartDate: startParsed.date,
        monthlyPriceSnapshotSar: plan.monthlyPriceSar,
        mileageAllowanceKm,
        mileageUsedKm: 0,
        depositSnapshotSar,
        autoRenew,
      },
    });

    const pay = await tx.subscriptionPayment.create({
      data: {
        subscriptionId: sub.id,
        amountSar: chargeTotalIncl,
        vatRatePercent: vatPct,
        paymentKind: "INITIAL",
        status: "PENDING",
        idempotencyKey,
      },
    });

    return { sub, pay };
  });

  return NextResponse.json({
    ok: true,
    subscriptionId: created.sub.id,
    paymentId: created.pay.id,
    pricing: {
      subtotalExcludingVat: subtotalExcl,
      vatAmount: vatAmt,
      vatRatePercent: vatPct,
      totalIncludingVat: chargeTotalIncl,
      depositExcludedFromVatDisplayNote:
        "العربون مُجمَّع ضمن الأساس قبل الضريبة في هذا الإصدار التجريبي.",
    },
  });
}
