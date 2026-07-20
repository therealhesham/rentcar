import type { Prisma } from "@prisma/client";
import { bookingPickupBranchScope } from "@/lib/booking-branches";
import { prisma } from "@/lib/prisma";

function bookingScope(
  branchSlug: string | null | undefined,
  extra?: Prisma.BookingRequestWhereInput,
): Prisma.BookingRequestWhereInput {
  const scope: Prisma.BookingRequestWhereInput = branchSlug
    ? bookingPickupBranchScope(branchSlug)
    : {};
  if (!extra || Object.keys(extra).length === 0) return scope;
  return { AND: [scope, extra] };
}

export type AdminStatsPeriod = 7 | 30 | 90 | 365;

export type DayCount = { dateKey: string; label: string; count: number };

export type LabelCount = { label: string; count: number; pct: number };

export function parseAdminStatsPeriod(raw: string | null | undefined): AdminStatsPeriod {
  const n = Number(raw);
  if (n === 7 || n === 30 || n === 90 || n === 365) return n;
  return 30;
}

export function periodStart(days: AdminStatsPeriod): Date {
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - (days - 1));
  return start;
}

function arDayLabel(d: Date): string {
  return d.toLocaleDateString("ar-SA", { day: "numeric", month: "short" });
}

export function buildDayBuckets(days: AdminStatsPeriod): DayCount[] {
  const buckets: DayCount[] = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateKey = d.toISOString().slice(0, 10);
    buckets.push({ dateKey, label: arDayLabel(d), count: 0 });
  }
  return buckets;
}

export function fillDayBuckets(buckets: DayCount[], dates: Date[]): DayCount[] {
  const map = new Map(buckets.map((b) => [b.dateKey, 0]));
  for (const dt of dates) {
    const key = dt.toISOString().slice(0, 10);
    if (map.has(key)) map.set(key, (map.get(key) ?? 0) + 1);
  }
  return buckets.map((b) => ({ ...b, count: map.get(b.dateKey) ?? 0 }));
}

export function toLabelCounts(
  rows: { key: string; count: number }[],
  emptyLabel = "غير محدد",
): LabelCount[] {
  const total = rows.reduce((s, r) => s + r.count, 0) || 1;
  return rows
    .filter((r) => r.count > 0)
    .sort((a, b) => b.count - a.count)
    .map((r) => ({
      label: r.key.trim() || emptyLabel,
      count: r.count,
      pct: Math.round((r.count / total) * 100),
    }));
}

export type AdminOverviewStats = {
  periodDays: AdminStatsPeriod;
  bookingsInPeriod: number;
  bookingsPrevPeriod: number;
  paidInPeriod: number;
  newInquiries: number;
  directInPeriod: number;
  corporateLeadsInPeriod: number;
  activeSubscriptions: number;
  fleetUnits: number;
  customersWithAccounts: number;
  bookingTrend: DayCount[];
  kindSplit: LabelCount[];
  paymentSplit: LabelCount[];
};

export async function getAdminOverviewStats(
  days: AdminStatsPeriod,
  branchSlug?: string | null,
): Promise<AdminOverviewStats> {
  const start = periodStart(days);
  const prevStart = new Date(start);
  prevStart.setDate(prevStart.getDate() - days);
  const scoped = (extra?: Prisma.BookingRequestWhereInput) => bookingScope(branchSlug, extra);

  const [
    bookingsInPeriod,
    bookingsPrevPeriod,
    paidInPeriod,
    newInquiries,
    directInPeriod,
    corporateLeadsInPeriod,
    activeSubscriptions,
    fleetRows,
    customersWithAccounts,
    trendDates,
    byKind,
    byPayment,
  ] = await Promise.all([
    prisma.bookingRequest.count({ where: scoped({ createdAt: { gte: start } }) }),
    prisma.bookingRequest.count({
      where: scoped({ createdAt: { gte: prevStart, lt: start } }),
    }),
    prisma.bookingRequest.count({
      where: scoped({ createdAt: { gte: start }, paymentStatus: "PAID" }),
    }),
    prisma.bookingRequest.count({
      where: scoped({ createdAt: { gte: start }, status: "NEW" }),
    }),
    prisma.bookingRequest.count({
      where: scoped({ createdAt: { gte: start }, kind: "DIRECT" }),
    }),
    branchSlug
      ? Promise.resolve(0)
      : prisma.corporateBookingLead.count({ where: { createdAt: { gte: start } } }),
    branchSlug ? Promise.resolve(0) : prisma.userSubscription.count({ where: { status: "ACTIVE" } }),
    branchSlug ? Promise.resolve([]) : prisma.fleet.findMany({ select: { quantity: true } }),
    branchSlug
      ? prisma.bookingRequest
          .findMany({
            where: scoped(),
            select: { phone: true },
            distinct: ["phone"],
          })
          .then((r) => r.length)
      : prisma.user.count(),
    prisma.bookingRequest.findMany({
      where: scoped({ createdAt: { gte: start } }),
      select: { createdAt: true },
    }),
    prisma.bookingRequest.groupBy({
      by: ["kind"],
      where: scoped({ createdAt: { gte: start } }),
      _count: { _all: true },
    }),
    prisma.bookingRequest.groupBy({
      by: ["paymentStatus"],
      where: scoped({ createdAt: { gte: start } }),
      _count: { _all: true },
    }),
  ]);

  const kindSplit = toLabelCounts(
    byKind.map((r) => ({
      key: r.kind === "DIRECT" ? "حجز مباشر" : "استفسار",
      count: r._count._all,
    })),
  );

  const paymentLabels: Record<string, string> = {
    PAID: "مدفوع",
    PENDING: "قيد الدفع",
    REFUNDED: "مسترد",
    PARTIAL_REFUND: "استرداد جزئي",
    NO_REFUND: "بدون استرداد",
  };

  const paymentSplit = toLabelCounts(
    byPayment.map((r) => ({
      key: paymentLabels[r.paymentStatus] ?? r.paymentStatus,
      count: r._count._all,
    })),
  );

  return {
    periodDays: days,
    bookingsInPeriod,
    bookingsPrevPeriod,
    paidInPeriod,
    newInquiries,
    directInPeriod,
    corporateLeadsInPeriod,
    activeSubscriptions,
    fleetUnits: fleetRows.reduce((s, r) => s + r.quantity, 0),
    customersWithAccounts,
    bookingTrend: fillDayBuckets(
      buildDayBuckets(days),
      trendDates.map((r) => r.createdAt),
    ),
    kindSplit,
    paymentSplit,
  };
}

export type AdminBookingStats = {
  periodDays: AdminStatsPeriod;
  total: number;
  trend: DayCount[];
  byStatus: LabelCount[];
  byBranch: LabelCount[];
  byPickupMode: LabelCount[];
  byPaymentMethod: LabelCount[];
  avgRentalDays: number;
  topModels: LabelCount[];
};

const STATUS_LABELS: Record<string, string> = {
  NEW: "جديد",
  UNDER_REVIEW: "تحت المراجعة",
  CONTACTED: "تم التواصل",
  CONFIRMED: "قادم",
  PICKED_UP: "استلام من الفرع",
  RETURNED: "إرجاع إلى الفرع",
  CANCELLED: "ملغي",
  COMPLETED: "مكتمل",
};

export async function getAdminBookingStats(
  days: AdminStatsPeriod,
  branchSlug?: string | null,
): Promise<AdminBookingStats> {
  const start = periodStart(days);
  const scoped = (extra?: Prisma.BookingRequestWhereInput) => bookingScope(branchSlug, extra);

  const [total, trendRows, byStatus, byBranch, byPickupMode, byPaymentMethod, aggregates, topModelsRaw] =
    await Promise.all([
      prisma.bookingRequest.count({ where: scoped({ createdAt: { gte: start } }) }),
      prisma.bookingRequest.findMany({
        where: scoped({ createdAt: { gte: start } }),
        select: { createdAt: true },
      }),
      prisma.bookingRequest.groupBy({
        by: ["status"],
        where: scoped({ createdAt: { gte: start } }),
        _count: { _all: true },
      }),
      prisma.bookingRequest.groupBy({
        by: ["branchId"],
        where: scoped({ createdAt: { gte: start }, branchId: { not: null } }),
        _count: { _all: true },
      }),
      prisma.bookingRequest.groupBy({
        by: ["pickupMode"],
        where: scoped({ createdAt: { gte: start } }),
        _count: { _all: true },
      }),
      prisma.bookingRequest.groupBy({
        by: ["paymentMethod"],
        where: scoped({ createdAt: { gte: start }, paymentMethod: { not: null } }),
        _count: { _all: true },
      }),
      prisma.bookingRequest.aggregate({
        where: scoped({ createdAt: { gte: start } }),
        _avg: { numberOfDays: true },
      }),
      prisma.bookingRequest.groupBy({
        by: ["carModelId"],
        where: scoped({ createdAt: { gte: start }, carModelId: { not: null } }),
        _count: { _all: true },
        orderBy: { _count: { carModelId: "desc" } },
        take: 8,
      }),
    ]);

  const modelIds = topModelsRaw
    .map((r) => r.carModelId)
    .filter((id): id is number => id != null);
  const branchIds = byBranch
    .map((r) => r.branchId)
    .filter((id): id is number => id != null);
  const [models, branches] = await Promise.all([
    modelIds.length > 0
      ? prisma.carModel.findMany({
          where: { id: { in: modelIds } },
          select: { id: true, name: true, brand: { select: { name: true } } },
        })
      : Promise.resolve([]),
    branchIds.length > 0
      ? prisma.branch.findMany({
          where: { id: { in: branchIds } },
          select: { id: true, name: true, slug: true },
        })
      : Promise.resolve([]),
  ]);
  const modelName = new Map(models.map((m) => [m.id, `${m.brand.name} ${m.name}`]));
  const branchLabel = new Map(
    branches.map((b) => [b.id, b.name.trim() || b.slug]),
  );

  const pickupLabels: Record<string, string> = {
    BRANCH: "استلام من الفرع",
    DELIVERY: "توصيل",
  };

  const methodLabels: Record<string, string> = {
    TABBY: "تابي",
    TAMARA: "تمارا",
    CARD: "بطاقة",
    APPLE_PAY: "Apple Pay",
    POINTS: "نقاط",
  };

  return {
    periodDays: days,
    total,
    trend: fillDayBuckets(
      buildDayBuckets(days),
      trendRows.map((r) => r.createdAt),
    ),
    byStatus: toLabelCounts(
      byStatus.map((r) => ({
        key: STATUS_LABELS[r.status] ?? r.status,
        count: r._count._all,
      })),
    ),
    byBranch: toLabelCounts(
      byBranch.map((r) => ({
        key: branchLabel.get(r.branchId!) ?? `فرع #${r.branchId}`,
        count: r._count._all,
      })),
    ).slice(0, 10),
    byPickupMode: toLabelCounts(
      byPickupMode.map((r) => ({
        key: r.pickupMode ? (pickupLabels[r.pickupMode] ?? r.pickupMode) : "غير محدد",
        count: r._count._all,
      })),
    ),
    byPaymentMethod: toLabelCounts(
      byPaymentMethod.map((r) => ({
        key: r.paymentMethod ? (methodLabels[r.paymentMethod] ?? r.paymentMethod) : "—",
        count: r._count._all,
      })),
    ),
    avgRentalDays: Math.round(aggregates._avg.numberOfDays ?? 0),
    topModels: toLabelCounts(
      topModelsRaw.map((r) => ({
        key: modelName.get(r.carModelId!) ?? `#${r.carModelId}`,
        count: r._count._all,
      })),
    ),
  };
}

export type AdminFleetStats = {
  categoriesCount: number;
  brandsCount: number;
  modelsCount: number;
  fleetUnits: number;
  modelsWithStock: number;
  zeroStockModels: number;
  byCategory: LabelCount[];
  byBrand: LabelCount[];
  topModelsByQty: LabelCount[];
};

export async function getAdminFleetStats(): Promise<AdminFleetStats> {
  const [categoriesCount, brandsCount, modelsCount, fleetRows, models] = await Promise.all([
    prisma.fleetCategory.count(),
    prisma.brand.count(),
    prisma.carModel.count(),
    prisma.fleet.findMany({ include: { model: { include: { brand: true, category: true } } } }),
    prisma.carModel.findMany({
      include: { brand: true, category: true, fleetItems: true },
    }),
  ]);

  const fleetUnits = fleetRows.reduce((s, r) => s + r.quantity, 0);
  const modelsWithStock = models.filter((m) => m.fleetItems.some((f) => f.quantity > 0)).length;
  const zeroStockModels = models.length - modelsWithStock;

  const catMap = new Map<string, number>();
  const brandMap = new Map<string, number>();
  for (const f of fleetRows) {
    const cat = f.model.category.title;
    const brand = f.model.brand.name;
    catMap.set(cat, (catMap.get(cat) ?? 0) + f.quantity);
    brandMap.set(brand, (brandMap.get(brand) ?? 0) + f.quantity);
  }

  const topModelsByQty = models
    .map((m) => ({
      label: `${m.brand.name} ${m.name}`,
      count: m.fleetItems.reduce((s, f) => s + f.quantity, 0),
    }))
    .filter((m) => m.count > 0)
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)
    .map((m) => ({ ...m, pct: 0 }));

  const catTotal = [...catMap.values()].reduce((a, b) => a + b, 0) || 1;
  const byCategory = [...catMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({
      label,
      count,
      pct: Math.round((count / catTotal) * 100),
    }));

  const brandTotal = [...brandMap.values()].reduce((a, b) => a + b, 0) || 1;
  const byBrand = [...brandMap.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([label, count]) => ({
      label,
      count,
      pct: Math.round((count / brandTotal) * 100),
    }));

  if (topModelsByQty.length > 0) {
    const t = topModelsByQty.reduce((s, m) => s + m.count, 0) || 1;
    topModelsByQty.forEach((m) => {
      m.pct = Math.round((m.count / t) * 100);
    });
  }

  return {
    categoriesCount,
    brandsCount,
    modelsCount,
    fleetUnits,
    modelsWithStock,
    zeroStockModels,
    byCategory,
    byBrand,
    topModelsByQty,
  };
}

export type AdminRevenueStats = {
  periodDays: AdminStatsPeriod;
  subscriptionPaidTotalSar: number;
  subscriptionPaidCount: number;
  subscriptionTrend: DayCount[];
  bookingPaidCount: number;
  bookingPendingCount: number;
  refundsTotalSar: number;
  refundsCount: number;
  bySubscriptionStatus: LabelCount[];
  subscriptionPaymentsByMethod: LabelCount[];
};

export async function getAdminRevenueStats(
  days: AdminStatsPeriod,
  branchSlug?: string | null,
): Promise<AdminRevenueStats> {
  const start = periodStart(days);
  const scoped = (extra?: Prisma.BookingRequestWhereInput) => bookingScope(branchSlug, extra);

  const [
    subPayments,
    subTrendDates,
    bookingPaidCount,
    bookingPendingCount,
    refundsAgg,
    refundsCount,
    bySubStatus,
    subPaymentsByMethod,
  ] = await Promise.all([
    branchSlug
      ? Promise.resolve({ _sum: { amountSar: 0 }, _count: { _all: 0 } })
      : prisma.subscriptionPayment.aggregate({
          where: { status: "PAID", paidAt: { gte: start } },
          _sum: { amountSar: true },
          _count: { _all: true },
        }),
    branchSlug
      ? Promise.resolve([])
      : prisma.subscriptionPayment.findMany({
          where: { status: "PAID", paidAt: { gte: start } },
          select: { paidAt: true },
        }),
    prisma.bookingRequest.count({
      where: scoped({ createdAt: { gte: start }, paymentStatus: "PAID" }),
    }),
    prisma.bookingRequest.count({
      where: scoped({ createdAt: { gte: start }, paymentStatus: "PENDING" }),
    }),
    prisma.bookingRequest.aggregate({
      where: scoped({
        createdAt: { gte: start },
        cancellationRefundAmountSar: { not: null },
      }),
      _sum: { cancellationRefundAmountSar: true },
    }),
    prisma.bookingRequest.count({
      where: scoped({
        createdAt: { gte: start },
        cancellationRefundAmountSar: { not: null },
      }),
    }),
    branchSlug
      ? Promise.resolve([])
      : prisma.userSubscription.groupBy({
          by: ["status"],
          _count: { _all: true },
        }),
    branchSlug
      ? Promise.resolve([])
      : prisma.subscriptionPayment.groupBy({
          by: ["paymentMethod"],
          where: { status: "PAID", paidAt: { gte: start }, paymentMethod: { not: null } },
          _count: { _all: true },
          _sum: { amountSar: true },
        }),
  ]);

  const subStatusLabels: Record<string, string> = {
    PENDING: "قيد المراجعة",
    ACTIVE: "نشط",
    SUSPENDED: "موقوف",
    EXPIRED: "منتهي",
    CANCELLED: "ملغي",
    REJECTED: "مرفوض",
  };

  const methodLabels: Record<string, string> = {
    TABBY: "تابي",
    TAMARA: "تمارا",
    CARD: "بطاقة",
    APPLE_PAY: "Apple Pay",
    POINTS: "نقاط",
  };

  const subscriptionPaymentsByMethod = toLabelCounts(
    subPaymentsByMethod.map((r) => ({
      key: r.paymentMethod ? (methodLabels[r.paymentMethod] ?? r.paymentMethod) : "أخرى",
      count: r._sum.amountSar ?? 0,
    })),
  ).map((r) => ({ ...r, label: `${r.label} (${formatSar(r.count)})` }));

  return {
    periodDays: days,
    subscriptionPaidTotalSar: subPayments._sum.amountSar ?? 0,
    subscriptionPaidCount: subPayments._count._all,
    subscriptionTrend: fillDayBuckets(
      buildDayBuckets(days),
      subTrendDates.map((r) => r.paidAt!).filter(Boolean),
    ),
    bookingPaidCount,
    bookingPendingCount,
    refundsTotalSar: Math.round(refundsAgg._sum.cancellationRefundAmountSar ?? 0),
    refundsCount,
    bySubscriptionStatus: toLabelCounts(
      bySubStatus.map((r) => ({
        key: subStatusLabels[r.status] ?? r.status,
        count: r._count._all,
      })),
    ),
    subscriptionPaymentsByMethod,
  };
}

export type AdminBranchStatRow = {
  branchId: number;
  name: string;
  cityName: string | null;
  /** حجوزات الفترة (فرع الاستلام) */
  bookingsInPeriod: number;
  bookingsPrevPeriod: number;
  paidInPeriod: number;
  /** المقبوضات الإجمالية خلال الفترة (بتاريخ الدفع، شاملة الضريبة) قبل خصم الاستردادات */
  grossSar: number;
  /** صافي إيراد الفترة: المقبوضات (بتاريخ الدفع) − استردادات الإلغاء (بتاريخ الإلغاء)، شامل الضريبة */
  revenueSar: number;
  /** استردادات إلغاء نُفّذت خلال الفترة (شاملة الضريبة) */
  refundsSar: number;
  /** سيارات مُسلَّمة للعملاء الآن (استُلمت ولم تُرجَع) */
  activeNow: number;
  fleetUnits: number;
  /** نسبة التشغيل الآن = قيد التشغيل ÷ وحدات الأسطول */
  utilizationPct: number;
  /** الموديل الأكثر حجزاً في الفترة */
  topModelLabel: string | null;
  topModelCount: number;
};

export type AdminBranchStats = {
  periodDays: AdminStatsPeriod;
  /** مرتّبة تنازلياً حسب حجوزات الفترة (الأكثر تشغيلاً أولاً) */
  rows: AdminBranchStatRow[];
  totals: {
    bookings: number;
    paid: number;
    grossSar: number;
    revenueSar: number;
    refundsSar: number;
    activeNow: number;
    fleetUnits: number;
  };
  /** حجوزات فترة بدون فرع استلام (توصيل/استفسارات قديمة) */
  unassignedBookings: number;
  /** توزيع حجوزات الفترة على الفروع (للأشرطة) */
  bookingsSplit: LabelCount[];
  /** توزيع إيراد الفترة على الفروع */
  revenueSplit: LabelCount[];
};

export async function getAdminBranchStats(
  days: AdminStatsPeriod,
  onlyBranchId?: number | null,
): Promise<AdminBranchStats> {
  const start = periodStart(days);
  const prevStart = new Date(start);
  prevStart.setDate(prevStart.getDate() - days);

  const [
    branches,
    byBranch,
    byBranchPrev,
    paidByBranch,
    revenueByBranch,
    refundsByBranch,
    activeByBranch,
    fleetByBranch,
    unassignedBookings,
    periodModelRows,
  ] = await Promise.all([
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true, city: { select: { name: true } } },
    }),
    prisma.bookingRequest.groupBy({
      by: ["branchId"],
      where: { createdAt: { gte: start }, branchId: { not: null } },
      _count: { _all: true },
    }),
    prisma.bookingRequest.groupBy({
      by: ["branchId"],
      where: { createdAt: { gte: prevStart, lt: start }, branchId: { not: null } },
      _count: { _all: true },
    }),
    prisma.bookingRequest.groupBy({
      by: ["branchId"],
      where: {
        createdAt: { gte: start },
        branchId: { not: null },
        paymentStatus: "PAID",
      },
      _count: { _all: true },
    }),
    prisma.bookingRequest.groupBy({
      by: ["branchId"],
      where: {
        paidAt: { gte: start },
        branchId: { not: null },
        paidAmountSar: { not: null },
      },
      _sum: { paidAmountSar: true },
    }),
    // استردادات الإلغاء المنفَّذة خلال الفترة (بتاريخ الإلغاء) — تُخصم من الإيراد
    prisma.bookingRequest.groupBy({
      by: ["branchId"],
      where: {
        cancelledAt: { gte: start },
        branchId: { not: null },
        cancellationRefundAmountSar: { not: null },
      },
      _sum: { cancellationRefundAmountSar: true },
    }),
    prisma.bookingRequest.groupBy({
      by: ["branchId"],
      where: {
        branchId: { not: null },
        vehiclePickedUpAt: { not: null },
        vehicleReturnedAt: null,
        status: { notIn: ["CANCELLED"] },
      },
      _count: { _all: true },
    }),
    prisma.fleet.groupBy({
      by: ["branchId"],
      _sum: { quantity: true },
    }),
    prisma.bookingRequest.count({
      where: { createdAt: { gte: start }, branchId: null },
    }),
    prisma.bookingRequest.findMany({
      where: {
        createdAt: { gte: start },
        branchId: { not: null },
        carModelId: { not: null },
      },
      select: {
        branchId: true,
        carModel: { select: { name: true, year: true, brand: { select: { name: true } } } },
      },
    }),
  ]);

  const countOf = (
    rows: { branchId: number | null; _count: { _all: number } }[],
    id: number,
  ) => rows.find((r) => r.branchId === id)?._count._all ?? 0;

  // الموديل الأكثر حجزاً لكل فرع
  const topModelByBranch = new Map<number, { label: string; count: number }>();
  {
    const perBranch = new Map<number, Map<string, number>>();
    for (const r of periodModelRows) {
      if (r.branchId == null || !r.carModel) continue;
      const label = `${r.carModel.brand.name} ${r.carModel.name} ${r.carModel.year}`;
      let m = perBranch.get(r.branchId);
      if (!m) {
        m = new Map();
        perBranch.set(r.branchId, m);
      }
      m.set(label, (m.get(label) ?? 0) + 1);
    }
    for (const [branchId, m] of perBranch) {
      let bestLabel: string | null = null;
      let bestCount = 0;
      for (const [label, count] of m) {
        if (count > bestCount) {
          bestLabel = label;
          bestCount = count;
        }
      }
      if (bestLabel) topModelByBranch.set(branchId, { label: bestLabel, count: bestCount });
    }
  }

  const visibleBranches =
    onlyBranchId != null ? branches.filter((b) => b.id === onlyBranchId) : branches;

  const rows: AdminBranchStatRow[] = visibleBranches
    .map((b) => {
      const fleetUnits = fleetByBranch.find((f) => f.branchId === b.id)?._sum.quantity ?? 0;
      const activeNow = countOf(activeByBranch, b.id);
      const top = topModelByBranch.get(b.id) ?? null;
      const grossSar =
        revenueByBranch.find((r) => r.branchId === b.id)?._sum.paidAmountSar ?? 0;
      const refundsSar =
        refundsByBranch.find((r) => r.branchId === b.id)?._sum.cancellationRefundAmountSar ?? 0;
      return {
        branchId: b.id,
        name: b.name,
        cityName: b.city?.name ?? null,
        bookingsInPeriod: countOf(byBranch, b.id),
        bookingsPrevPeriod: countOf(byBranchPrev, b.id),
        paidInPeriod: countOf(paidByBranch, b.id),
        grossSar: Math.round(grossSar * 100) / 100,
        revenueSar: Math.round((grossSar - refundsSar) * 100) / 100,
        refundsSar: Math.round(refundsSar * 100) / 100,
        activeNow,
        fleetUnits,
        utilizationPct: fleetUnits > 0 ? Math.round((activeNow / fleetUnits) * 100) : 0,
        topModelLabel: top?.label ?? null,
        topModelCount: top?.count ?? 0,
      };
    })
    .sort((a, b) => b.bookingsInPeriod - a.bookingsInPeriod || b.revenueSar - a.revenueSar);

  const totals = {
    bookings: rows.reduce((s, r) => s + r.bookingsInPeriod, 0),
    paid: rows.reduce((s, r) => s + r.paidInPeriod, 0),
    grossSar: Math.round(rows.reduce((s, r) => s + r.grossSar, 0) * 100) / 100,
    revenueSar: Math.round(rows.reduce((s, r) => s + r.revenueSar, 0) * 100) / 100,
    refundsSar: Math.round(rows.reduce((s, r) => s + r.refundsSar, 0) * 100) / 100,
    activeNow: rows.reduce((s, r) => s + r.activeNow, 0),
    fleetUnits: rows.reduce((s, r) => s + r.fleetUnits, 0),
  };

  const bookingsSplit = toLabelCounts(
    rows
      .filter((r) => r.bookingsInPeriod > 0)
      .map((r) => ({ key: r.name, count: r.bookingsInPeriod })),
  );
  const revenueTotal = totals.revenueSar || 1;
  const revenueSplit = rows
    .filter((r) => r.revenueSar > 0)
    .map((r) => ({
      label: r.name,
      count: Math.round(r.revenueSar),
      pct: Math.round((r.revenueSar / revenueTotal) * 100),
    }));

  return {
    periodDays: days,
    rows,
    totals,
    unassignedBookings,
    bookingsSplit,
    revenueSplit,
  };
}

export type AdminBranchDetailStats = {
  periodDays: AdminStatsPeriod;
  branch: { id: number; name: string; cityName: string | null; slug: string };
  bookingsInPeriod: number;
  bookingsPrevPeriod: number;
  paidInPeriod: number;
  /** المقبوضات الإجمالية خلال الفترة قبل خصم الاستردادات */
  grossSar: number;
  /** صافي إيراد الفترة (المقبوضات − استردادات الإلغاء) شامل الضريبة */
  revenueSar: number;
  /** استردادات إلغاء نُفّذت خلال الفترة */
  refundsSar: number;
  activeNow: number;
  /** إرجاعات استُلمت في هذا الفرع خلال الفترة */
  returnsInPeriod: number;
  fleetUnits: number;
  utilizationPct: number;
  trend: DayCount[];
  byStatus: LabelCount[];
  byPayment: LabelCount[];
  topModels: LabelCount[];
  /** تشكيلة أسطول الفرع: الكمية والسعر الفعلي (تجاوز الفرع إن وُجد) */
  fleetModels: {
    modelId: number;
    label: string;
    quantity: number;
    priceExclTax: number;
    hasBranchPrice: boolean;
  }[];
  recentBookings: {
    id: number;
    fullName: string;
    createdAt: Date;
    statusLabel: string;
    paymentLabel: string;
    carModelLabel: string | null;
    totalSar: number | null;
  }[];
};

const PAYMENT_LABELS: Record<string, string> = {
  PAID: "مدفوع",
  PENDING: "قيد الدفع",
  REFUNDED: "مسترد",
  PARTIAL_REFUND: "استرداد جزئي",
  NO_REFUND: "بدون استرداد",
};

export async function getAdminBranchDetailStats(
  branchId: number,
  days: AdminStatsPeriod,
): Promise<AdminBranchDetailStats | null> {
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, isActive: true },
    select: { id: true, name: true, slug: true, city: { select: { name: true } } },
  });
  if (!branch) return null;

  const start = periodStart(days);
  const prevStart = new Date(start);
  prevStart.setDate(prevStart.getDate() - days);
  const inPeriod = { branchId, createdAt: { gte: start } } as const;

  const [
    bookingsInPeriod,
    bookingsPrevPeriod,
    paidInPeriod,
    revenueAgg,
    refundsAgg,
    activeNow,
    returnsInPeriod,
    fleetRows,
    trendRows,
    byStatusRaw,
    byPaymentRaw,
    topModelsRaw,
    recentRows,
  ] = await Promise.all([
    prisma.bookingRequest.count({ where: inPeriod }),
    prisma.bookingRequest.count({
      where: { branchId, createdAt: { gte: prevStart, lt: start } },
    }),
    prisma.bookingRequest.count({ where: { ...inPeriod, paymentStatus: "PAID" } }),
    prisma.bookingRequest.aggregate({
      where: { branchId, paidAt: { gte: start }, paidAmountSar: { not: null } },
      _sum: { paidAmountSar: true },
    }),
    prisma.bookingRequest.aggregate({
      where: {
        branchId,
        cancelledAt: { gte: start },
        cancellationRefundAmountSar: { not: null },
      },
      _sum: { cancellationRefundAmountSar: true },
    }),
    prisma.bookingRequest.count({
      where: {
        branchId,
        vehiclePickedUpAt: { not: null },
        vehicleReturnedAt: null,
        status: { notIn: ["CANCELLED"] },
      },
    }),
    prisma.bookingRequest.count({
      where: { returnBranchId: branchId, vehicleReturnedAt: { gte: start } },
    }),
    prisma.fleet.findMany({
      where: { branchId },
      select: {
        modelId: true,
        quantity: true,
        pricePerDayExclTax: true,
        model: {
          select: { name: true, year: true, price: true, brand: { select: { name: true } } },
        },
      },
      orderBy: { quantity: "desc" },
    }),
    prisma.bookingRequest.findMany({
      where: inPeriod,
      select: { createdAt: true },
    }),
    prisma.bookingRequest.groupBy({
      by: ["status"],
      where: inPeriod,
      _count: { _all: true },
    }),
    prisma.bookingRequest.groupBy({
      by: ["paymentStatus"],
      where: inPeriod,
      _count: { _all: true },
    }),
    prisma.bookingRequest.groupBy({
      by: ["carModelId"],
      where: { ...inPeriod, carModelId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { carModelId: "desc" } },
      take: 8,
    }),
    prisma.bookingRequest.findMany({
      where: { branchId },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        fullName: true,
        createdAt: true,
        status: true,
        paymentStatus: true,
        paidAmountSar: true,
        snapshotTotalAmountSar: true,
        carModel: { select: { name: true, year: true, brand: { select: { name: true } } } },
      },
    }),
  ]);

  // أسماء موديلات الأكثر طلباً
  const topModelIds = topModelsRaw
    .map((r) => r.carModelId)
    .filter((id): id is number => id != null);
  const topModelNames = topModelIds.length
    ? await prisma.carModel.findMany({
        where: { id: { in: topModelIds } },
        select: { id: true, name: true, year: true, brand: { select: { name: true } } },
      })
    : [];
  const topModels = toLabelCounts(
    topModelsRaw
      .filter((r) => r.carModelId != null)
      .map((r) => {
        const m = topModelNames.find((x) => x.id === r.carModelId);
        return {
          key: m ? `${m.brand.name} ${m.name} ${m.year}` : `موديل #${r.carModelId}`,
          count: r._count._all,
        };
      }),
  );

  const fleetUnits = fleetRows.reduce((s, r) => s + r.quantity, 0);
  const grossSar = Math.round((revenueAgg._sum.paidAmountSar ?? 0) * 100) / 100;
  const refundsSar =
    Math.round((refundsAgg._sum.cancellationRefundAmountSar ?? 0) * 100) / 100;
  const revenueSar = Math.round((grossSar - refundsSar) * 100) / 100;

  return {
    periodDays: days,
    branch: {
      id: branch.id,
      name: branch.name,
      cityName: branch.city?.name ?? null,
      slug: branch.slug,
    },
    bookingsInPeriod,
    bookingsPrevPeriod,
    paidInPeriod,
    grossSar,
    revenueSar,
    refundsSar,
    activeNow,
    returnsInPeriod,
    fleetUnits,
    utilizationPct: fleetUnits > 0 ? Math.round((activeNow / fleetUnits) * 100) : 0,
    trend: fillDayBuckets(
      buildDayBuckets(days),
      trendRows.map((r) => r.createdAt),
    ),
    byStatus: toLabelCounts(
      byStatusRaw.map((r) => ({
        key: STATUS_LABELS[r.status] ?? r.status,
        count: r._count._all,
      })),
    ),
    byPayment: toLabelCounts(
      byPaymentRaw.map((r) => ({
        key: PAYMENT_LABELS[r.paymentStatus] ?? r.paymentStatus,
        count: r._count._all,
      })),
    ),
    topModels,
    fleetModels: fleetRows
      .filter((r) => r.quantity > 0 || r.pricePerDayExclTax != null)
      .map((r) => ({
        modelId: r.modelId,
        label: `${r.model.brand.name} ${r.model.name} ${r.model.year}`,
        quantity: r.quantity,
        priceExclTax: r.pricePerDayExclTax ?? r.model.price,
        hasBranchPrice: r.pricePerDayExclTax != null,
      })),
    recentBookings: recentRows.map((r) => ({
      id: r.id,
      fullName: r.fullName,
      createdAt: r.createdAt,
      statusLabel: STATUS_LABELS[r.status] ?? r.status,
      paymentLabel: PAYMENT_LABELS[r.paymentStatus] ?? r.paymentStatus,
      carModelLabel: r.carModel
        ? `${r.carModel.brand.name} ${r.carModel.name} ${r.carModel.year}`
        : null,
      totalSar: r.paidAmountSar ?? r.snapshotTotalAmountSar ?? null,
    })),
  };
}

export function formatSar(n: number): string {
  return new Intl.NumberFormat("ar-SA", { maximumFractionDigits: 0 }).format(n);
}

export function trendDeltaPct(current: number, previous: number): number | null {
  if (previous === 0) return current > 0 ? 100 : null;
  return Math.round(((current - previous) / previous) * 100);
}
