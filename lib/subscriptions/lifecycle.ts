import type { SubscriptionStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { addUtcCalendarMonths, startOfUtcDay } from "@/lib/subscriptions/utc-calendar";

/** نافذة فعالة من يوم بدء وحتى مدة اشتراك (أشهر تقويمية UTC). */
export function computeSubscriptionWindow(
  periodStart: Date,
  durationMonths: number,
): { startAt: Date; endAt: Date } {
  const startAt = startOfUtcDay(periodStart);
  const endAt = addUtcCalendarMonths(startAt, durationMonths);
  return { startAt, endAt };
}

/**
 * عند الموافقة: اليوم الأول = الأكبر بين «يوم البداية الذي اختاره العميل» وبين يوم الموافقة
 * (لمَن تأخّرت الموافقة)، وتُشتق النهاية تلقائيًا من عدد الأشهر.
 */
export function computeSubscriptionPeriodFromApproval(args: {
  plannedStartDate: Date | null;
  approvedAt: Date;
  durationMonths: number;
}): { startAt: Date; endAt: Date } {
  const approveDay = startOfUtcDay(args.approvedAt);
  const plannedDay =
    args.plannedStartDate != null ? startOfUtcDay(args.plannedStartDate) : approveDay;
  const effectiveStart = plannedDay > approveDay ? plannedDay : approveDay;
  return computeSubscriptionWindow(effectiveStart, args.durationMonths);
}

/** Alias للتوافق مع كود قائم / تسمية خارجية؛ يعتبر الموافقة = بداية المدة إن لم يُخزَّن طلب بدء مسبق. */
export function computeActiveWindowFromApproval(
  approvedAt: Date,
  durationMonths: number,
): { startAt: Date; endAt: Date } {
  return computeSubscriptionPeriodFromApproval({
    plannedStartDate: null,
    approvedAt,
    durationMonths,
  });
}

/**
 * مهام دورية (تُستدعى من `/api/cron/subscriptions` بحماية سرّية):
 * – انتهاء الاشتراكات النشطة بعد `endAt`
 * – تذكير التجديد قبل 7 أيام (يحدّث الطابع الزمني لتجنّب التكرار المفرط)
 * – تعليق مبدئي عند استحقاق دفعة ومضيّ الموعد (يحتاج تكاملاً حقيقياً مع بوابة الدفع)
 */
export async function runSubscriptionCronJobs() {
  const now = new Date();

  await prisma.userSubscription.updateMany({
    where: {
      status: "ACTIVE",
      endAt: { lt: now },
    },
    data: { status: "EXPIRED", updatedAt: now },
  });

  const reminderWindowMs = 7 * 24 * 60 * 60 * 1000;

  await prisma.userSubscription.updateMany({
    where: {
      status: "ACTIVE",
      autoRenew: true,
      endAt: { lt: new Date(now.getTime() + reminderWindowMs), gte: now },
      OR: [{ lastRenewalReminderAt: null }, { lastRenewalReminderAt: { lt: now } }],
    },
    data: {
      lastRenewalReminderAt: now,
      updatedAt: now,
    },
  });

  await prisma.userSubscription.updateMany({
    where: {
      status: "ACTIVE",
      nextPaymentDueAt: { lte: now },
      unpaidNotifiedAt: null,
    },
    data: {
      status: "SUSPENDED",
      suspendedReasonAr: "لم يتم استلام دفعة التجديد في الموعد.",
      unpaidNotifiedAt: now,
      updatedAt: now,
    },
  });
}

export function canCustomerCancel(status: SubscriptionStatus): boolean {
  return status === "PENDING" || status === "ACTIVE";
}
