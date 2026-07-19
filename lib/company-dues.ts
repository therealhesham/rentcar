import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * حسبة المركز المالي للمستحقات باتجاهين:
 * - receivables (مستحقات للشركة): رصيد على العملاء يُحصَّل عند الفرع (balanceDueAtBranchSar).
 * - payables (مستحقات على الشركة): مبالغ مستحقة للعملاء لم تُسوَّ بعد (refundDueToCustomerSar).
 *
 * النطاق (scope) يحدّ النتائج بفرع الموظف؛ سوبر أدمن يرى الكل.
 */

export type DuesScope = { isSuperAdmin: boolean; branchId: number | null };

/** الحالات التي يسقط عندها الرصيد عند الفرع (لا يُحتسب مستحقاً). */
const RECEIVABLE_TERMINAL_STATUSES = ["CANCELLED", "REJECTED"];

/** شرط تحديد الفرع — مطابق لبقية صفحات الإدارة (استلام أو إرجاع في فرع الموظف). */
function scopeWhere(scope: DuesScope): Prisma.BookingRequestWhereInput {
  if (scope.isSuperAdmin || scope.branchId == null) return {};
  return {
    OR: [{ branchId: scope.branchId }, { returnBranchId: scope.branchId }],
  };
}

export function companyReceivablesWhere(
  scope: DuesScope,
): Prisma.BookingRequestWhereInput {
  return {
    ...scopeWhere(scope),
    balanceDueAtBranchSar: { gt: 0 },
    status: { notIn: RECEIVABLE_TERMINAL_STATUSES },
  };
}

export function companyPayablesWhere(
  scope: DuesScope,
): Prisma.BookingRequestWhereInput {
  return {
    ...scopeWhere(scope),
    refundDueToCustomerSar: { gt: 0 },
    refundDueSettledAt: null,
  };
}

export type DuesSide = { count: number; totalSar: number };

export type CompanyDuesPosition = {
  /** مستحقات للشركة على العملاء (رصيد عند الفرع). */
  receivables: DuesSide;
  /** مستحقات على الشركة للعملاء (استرداد لم يُسوَّ). */
  payables: DuesSide;
  /** الصافي = المستحق للشركة − المستحق عليها (موجب = صالح الشركة). */
  netSar: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** ملخص الاتجاهين — يُستخدم في كروت صفحة financials وأعلى صفحة المستحقات. */
export async function getCompanyDuesPosition(
  scope: DuesScope,
): Promise<CompanyDuesPosition> {
  const [recv, pay] = await Promise.all([
    prisma.bookingRequest.aggregate({
      where: companyReceivablesWhere(scope),
      _sum: { balanceDueAtBranchSar: true },
      _count: true,
    }),
    prisma.bookingRequest.aggregate({
      where: companyPayablesWhere(scope),
      _sum: { refundDueToCustomerSar: true },
      _count: true,
    }),
  ]);

  const receivablesTotal = round2(recv._sum.balanceDueAtBranchSar ?? 0);
  const payablesTotal = round2(pay._sum.refundDueToCustomerSar ?? 0);

  return {
    receivables: { count: recv._count, totalSar: receivablesTotal },
    payables: { count: pay._count, totalSar: payablesTotal },
    netSar: round2(receivablesTotal - payablesTotal),
  };
}

export type CompanyReceivableRow = Prisma.BookingRequestGetPayload<{
  include: { carModel: { include: { brand: true } } };
}>;

/** حجوزات عليها رصيد للشركة — للجدول التفصيلي في صفحة المستحقات. */
export async function getCompanyReceivableBookings(
  scope: DuesScope,
): Promise<CompanyReceivableRow[]> {
  return prisma.bookingRequest.findMany({
    where: companyReceivablesWhere(scope),
    orderBy: { pickupDate: "asc" },
    include: { carModel: { include: { brand: true } } },
  });
}
