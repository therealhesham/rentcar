"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { computeSubscriptionPeriodFromApproval } from "@/lib/subscriptions/lifecycle";
import { parseDurationOptionsCsv } from "@/lib/subscriptions/duration-options";

function fail(msg: string) {
  return { ok: false as const, error: msg };
}

export async function approveUserSubscription(subscriptionId: number) {
  if (!(await verifyAdminSession())) return fail("غير مصرّح.");
  if (!Number.isInteger(subscriptionId) || subscriptionId < 1) return fail("معرّف غير صالح.");

  const row = await prisma.userSubscription.findUnique({
    where: { id: subscriptionId },
    include: {
      payments: { where: { paymentKind: "INITIAL", status: "PAID" }, take: 1 },
      documents: true,
    },
  });
  if (!row) return fail("الاشتراك غير موجود.");
  if (row.status !== "PENDING") return fail("لا يمكن الموافقة لهذه الحالة.");
  if (!row.payments[0]) return fail("لم تُسدَّد الدفعة الأولية بعد.");
  const hasLicense = row.documents.some((d) => d.kind === "DRIVERS_LICENSE");
  const hasId = row.documents.some((d) => d.kind === "NATIONAL_ID");
  if (!hasLicense || !hasId) return fail("يجب رفع رخصة القيادة والهوية.");

  const approvedAt = new Date();
  const { startAt, endAt } = computeSubscriptionPeriodFromApproval({
    plannedStartDate: row.plannedStartDate,
    approvedAt,
    durationMonths: row.durationMonths,
  });

  await prisma.userSubscription.update({
    where: { id: subscriptionId },
    data: {
      status: "ACTIVE",
      approvedAt,
      startAt,
      endAt,
      nextPaymentDueAt: row.autoRenew ? endAt : null,
    },
  });

  revalidatePath("/admin/subscriptions");
  revalidatePath("/account/subscription");
  return { ok: true as const };
}

export async function rejectUserSubscription(subscriptionId: number, reasonAr: string) {
  if (!(await verifyAdminSession())) return fail("غير مصرّح.");
  const row = await prisma.userSubscription.findUnique({ where: { id: subscriptionId } });
  if (!row) return fail("غير موجود.");
  await prisma.userSubscription.update({
    where: { id: subscriptionId },
    data: {
      status: "REJECTED",
      rejectionReasonAr: reasonAr.slice(0, 500),
    },
  });
  revalidatePath("/admin/subscriptions");
  revalidatePath("/account/subscription");
  return { ok: true as const };
}

export async function setUserSubscriptionStatus(opts: {
  subscriptionId: number;
  status:
    | "PENDING"
    | "ACTIVE"
    | "SUSPENDED"
    | "EXPIRED"
    | "CANCELLED"
    | "REJECTED";
  suspendedReasonAr?: string;
}) {
  if (!(await verifyAdminSession())) return fail("غير مصرّح.");
  const { subscriptionId, status } = opts;

  await prisma.userSubscription.update({
    where: { id: subscriptionId },
    data: {
      status,
      ...(status === "SUSPENDED"
        ? { suspendedReasonAr: opts.suspendedReasonAr ?? "قرار إدارى." }
        : {}),
      ...(status === "CANCELLED" ? { cancelledAt: new Date() } : {}),
    },
  });
  revalidatePath("/admin/subscriptions");
  revalidatePath("/account/subscription");
  return { ok: true as const };
}

/** إنشاء خطة اشتراك مرتبطة بموديل موجود (أسعار غير شامل الضريبة). */
export async function createSubscriptionPlan(data: FormData) {
  if (!(await verifyAdminSession())) return fail("غير مصرّح.");
  const slug = String(data.get("slug") ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "-")
    .slice(0, 120);
  const carModelId = Number(data.get("carModelId"));
  const marketingTitleAr = String(data.get("marketingTitleAr") ?? "").trim() || null;
  const descriptionAr = String(data.get("descriptionAr") ?? "").trim() || null;
  const monthlyPriceSar = Number(data.get("monthlyPriceSar"));
  const mileageKmPerMonth = Number(data.get("mileageKmPerMonth"));
  const depositAmountSar = Number(data.get("depositAmountSar") ?? 0);
  const extraKmFeeSarPerKm = Number(data.get("extraKmFeeSarPerKm") ?? 3);
  const durationOptionsCsv = String(data.get("durationOptionsCsv") ?? "3,6,12").trim();
  parseDurationOptionsCsv(durationOptionsCsv);

  if (!slug || !/^[-a-z0-9]+$/.test(slug)) return fail("slug بالإنجليزية وفواصل بدون مسافات.");
  if (!Number.isInteger(carModelId) || carModelId < 1) return fail("اختر موديل المركبة.");
  if (!Number.isFinite(monthlyPriceSar) || monthlyPriceSar <= 0) return fail("سعر شهر غير صالح.");
  if (!Number.isFinite(mileageKmPerMonth) || mileageKmPerMonth < 500) return fail("البدلات الكيلومترية ضعيفة.");

  await prisma.subscriptionPlan.create({
    data: {
      slug,
      carModelId,
      marketingTitleAr,
      descriptionAr,
      monthlyPriceSar: Math.round(monthlyPriceSar),
      mileageKmPerMonth: Math.round(mileageKmPerMonth),
      insuranceIncluded: data.get("insuranceIncluded") === "on",
      maintenanceIncluded: data.get("maintenanceIncluded") === "on",
      depositAmountSar: Math.round(depositAmountSar),
      extraKmFeeSarPerKm: Math.round(extraKmFeeSarPerKm),
      durationOptionsCsv,
    },
  });
  revalidatePath("/admin/subscription-plans");
  revalidatePath("/subscriptions");
  return { ok: true as const };
}

export async function deactivateSubscriptionPlan(planId: number) {
  if (!(await verifyAdminSession())) return fail("غير مصرّح.");
  await prisma.subscriptionPlan.updateMany({
    where: { id: planId },
    data: { isActive: false },
  });
  revalidatePath("/admin/subscription-plans");
  revalidatePath("/subscriptions");
  return { ok: true as const };
}
