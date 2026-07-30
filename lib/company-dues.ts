import type { Prisma } from "@prisma/client";
import { computeCheckoutTotals } from "@/lib/booking-checkout-pricing";
import {
  parseBookingPricingSnapshot,
  resolveBookingRentalPricePerDayExclTax,
} from "@/lib/booking-pricing-snapshot";
import { prisma } from "@/lib/prisma";

/**
 * حسبة المركز المالي للمستحقات باتجاهين:
 * - receivables (مستحقات للشركة) بفئتين:
 *   • UNPAID_BOOKING: حجز مباشر قائم لم يُدفع إجماليه بعد (يُحصَّل إلكترونياً أو عند الفرع).
 *   • MODIFICATION_BALANCE: رصيد على حجز مدفوع (فرق تمديد/تعديل أو غرامة تأخير) يُحصَّل عند الفرع.
 * - payables (مستحقات على الشركة): مبالغ مستحقة للعملاء لم تُسوَّ بعد (refundDueToCustomerSar).
 *
 * النطاق (scope) يحدّ النتائج بفرع الموظف؛ سوبر أدمن يرى الكل.
 */

export type DuesScope = { isSuperAdmin: boolean; branchId: number | null };

/** الحالات التي يسقط عندها الاستحقاق (لا يُحتسب). */
const RECEIVABLE_TERMINAL_STATUSES = ["CANCELLED", "REJECTED"];

/** شرط تحديد الفرع — مطابق لبقية صفحات الإدارة (استلام أو إرجاع في فرع الموظف). */
function scopeWhere(scope: DuesScope): Prisma.BookingRequestWhereInput {
  if (scope.isSuperAdmin || scope.branchId == null) return {};
  return {
    OR: [{ branchId: scope.branchId }, { returnBranchId: scope.branchId }],
  };
}

/** رصيد على حجز مدفوع (فرق تمديد/تعديل/غرامة) — الفئة الكلاسيكية. */
export function companyModificationBalancesWhere(
  scope: DuesScope,
): Prisma.BookingRequestWhereInput {
  return {
    ...scopeWhere(scope),
    balanceDueAtBranchSar: { gt: 0 },
    status: { notIn: RECEIVABLE_TERMINAL_STATUSES },
  };
}

/** حجوزات مباشرة قائمة لم يُدفع إجماليها بعد. */
export function companyUnpaidBookingsWhere(
  scope: DuesScope,
): Prisma.BookingRequestWhereInput {
  return {
    ...scopeWhere(scope),
    kind: "DIRECT",
    paymentStatus: "PENDING",
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
  /** إجمالي مستحقات للشركة على العملاء (الفئتان معاً). */
  receivables: DuesSide;
  /** منها: حجوزات قائمة غير مدفوعة (إجمالي الحجز). */
  unpaidBookings: DuesSide;
  /** منها: أرصدة على حجوزات مدفوعة (فروق تمديد/تعديل/غرامات). */
  modificationBalances: DuesSide;
  /** مستحقات على الشركة للعملاء (استرداد لم يُسوَّ). */
  payables: DuesSide;
  /** الصافي = المستحق للشركة − المستحق عليها (موجب = صالح الشركة). */
  netSar: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export type CompanyReceivableCategory = "UNPAID_BOOKING" | "MODIFICATION_BALANCE";

type BookingWithModel = Prisma.BookingRequestGetPayload<{
  include: { carModel: { include: { brand: true } } };
}>;

export type CompanyReceivableItem = {
  booking: BookingWithModel;
  category: CompanyReceivableCategory;
  /** المبلغ المستحق للشركة (شامل الضريبة). */
  dueSar: number;
  /** الحجز يتضمن غرامة تأخير مسجّلة في لقطة التسعير. */
  hasDelayPenalty: boolean;
  /**
   * الجزء من `dueSar` الناتج عن رسوم إضافية (تلفيات/وقود/مخالفات) لا عن فرق تمديد.
   * يميّز التسمية في الواجهة: رصيد كلّه رسوم ليس «فرق تعديل/تمديد».
   */
  extraChargesDueSar: number;
};

/**
 * إجمالي الحجز المستحق لحجز غير مدفوع: اللقطة المجمّدة أولاً، وإلا
 * إعادة احتساب من لقطة التسعير (نفس منطق صفحة الدفع).
 */
function unpaidBookingDueSar(b: BookingWithModel): number {
  if (b.snapshotTotalAmountSar != null && b.snapshotTotalAmountSar > 0) {
    return round2(b.snapshotTotalAmountSar);
  }
  if (!b.carModel) return 0;
  const { addons, interCityShipping, checkoutOneTimeFees, delayPenalty, couponCode } =
    parseBookingPricingSnapshot(b.addonsJson);
  const rentalPrice = resolveBookingRentalPricePerDayExclTax(b.carModel.price, b.addonsJson);
  const oneTime =
    (interCityShipping?.feeExclVatSar ?? 0) +
    checkoutOneTimeFees.reduce((s, x) => s + x.feeExclVatSar, 0) +
    (delayPenalty?.feeExclVatSar ?? 0);
  const discountExclTax = couponCode?.scope === "FULL_TOTAL" ? couponCode.discountExclTax : 0;
  const totals = computeCheckoutTotals(
    rentalPrice,
    b.numberOfDays,
    b.carModel.vatRatePercent,
    addons.map((a) => ({ pricePerDay: a.pricePerDayExclTax })),
    { oneTimeFeesExclTax: oneTime, discountExclTax },
  );
  return round2(totals.totalInclTax);
}

/** ترتيب حسب الخطورة: خدمة اكتملت دون تحصيل أولاً، ثم قيد التشغيل، ثم القادم. */
function severityRank(status: string): number {
  const s = status.trim().toUpperCase();
  if (s === "RETURNED" || s === "COMPLETED") return 0;
  if (s === "PICKED_UP") return 1;
  return 2;
}

/** كل مستحقات الشركة (الفئتان) — مرتّبة بالأخطر ثم الأقرب استلاماً. */
export async function getCompanyReceivables(
  scope: DuesScope,
): Promise<CompanyReceivableItem[]> {
  const include = { carModel: { include: { brand: true } } } as const;
  const [balances, unpaid] = await Promise.all([
    prisma.bookingRequest.findMany({
      where: companyModificationBalancesWhere(scope),
      include,
    }),
    prisma.bookingRequest.findMany({
      where: companyUnpaidBookingsWhere(scope),
      include,
    }),
  ]);

  // كم من رصيد كل حجز مصدره رسوم إضافية — لتسمية البند بدقة في الواجهة.
  const chargeSums = await prisma.bookingExtraCharge.groupBy({
    by: ["bookingId"],
    where: {
      status: "ACTIVE",
      bookingId: { in: [...balances, ...unpaid].map((b) => b.id) },
    },
    _sum: { amountInclTaxSar: true },
  });
  const chargesByBooking = new Map(
    chargeSums.map((c) => [c.bookingId, round2(c._sum.amountInclTaxSar ?? 0)]),
  );

  const items: CompanyReceivableItem[] = [];
  for (const b of balances) {
    const dueSar = round2(b.balanceDueAtBranchSar ?? 0);
    items.push({
      booking: b,
      category: "MODIFICATION_BALANCE",
      dueSar,
      hasDelayPenalty: parseBookingPricingSnapshot(b.addonsJson).delayPenalty != null,
      // الرسوم المحصَّلة جزئياً لا تتجاوز الرصيد الباقي.
      extraChargesDueSar: Math.min(chargesByBooking.get(b.id) ?? 0, dueSar),
    });
  }
  for (const b of unpaid) {
    const due = unpaidBookingDueSar(b);
    if (due <= 0) continue;
    items.push({
      booking: b,
      category: "UNPAID_BOOKING",
      dueSar: due,
      hasDelayPenalty: parseBookingPricingSnapshot(b.addonsJson).delayPenalty != null,
      extraChargesDueSar: Math.min(chargesByBooking.get(b.id) ?? 0, due),
    });
  }

  return items.sort(
    (a, b) =>
      severityRank(a.booking.status) - severityRank(b.booking.status) ||
      a.booking.pickupDate.getTime() - b.booking.pickupDate.getTime(),
  );
}

/** ملخص الاتجاهين — يُستخدم في كروت صفحة financials وأعلى صفحة المستحقات. */
export async function getCompanyDuesPosition(
  scope: DuesScope,
): Promise<CompanyDuesPosition> {
  const [items, pay] = await Promise.all([
    getCompanyReceivables(scope),
    prisma.bookingRequest.aggregate({
      where: companyPayablesWhere(scope),
      _sum: { refundDueToCustomerSar: true },
      _count: true,
    }),
  ]);

  const unpaidItems = items.filter((i) => i.category === "UNPAID_BOOKING");
  const balanceItems = items.filter((i) => i.category === "MODIFICATION_BALANCE");
  const unpaidTotal = round2(unpaidItems.reduce((s, i) => s + i.dueSar, 0));
  const balancesTotal = round2(balanceItems.reduce((s, i) => s + i.dueSar, 0));
  const receivablesTotal = round2(unpaidTotal + balancesTotal);
  const payablesTotal = round2(pay._sum.refundDueToCustomerSar ?? 0);

  return {
    receivables: { count: items.length, totalSar: receivablesTotal },
    unpaidBookings: { count: unpaidItems.length, totalSar: unpaidTotal },
    modificationBalances: { count: balanceItems.length, totalSar: balancesTotal },
    payables: { count: pay._count, totalSar: payablesTotal },
    netSar: round2(receivablesTotal - payablesTotal),
  };
}
