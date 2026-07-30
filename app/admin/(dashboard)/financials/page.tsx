import { requireAdminPagePermission } from "@/lib/admin-page";
import { ReportExportButtons } from "@/components/admin/ReportExportButtons";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import { getAdminRevenueStats, formatSar } from "@/lib/admin-statistics";
import { getCompanyDuesPosition } from "@/lib/company-dues";
import { prisma } from "@/lib/prisma";
import { RegisterBookingPaymentModal } from "./RegisterBookingPaymentModal";
import Link from "next/link";
import { parseBookingPricingSnapshot, resolveBookingRentalPricePerDayExclTax } from "@/lib/booking-pricing-snapshot";
import { computeCheckoutTotals } from "@/lib/booking-checkout-pricing";
import { FinancialsFilters } from "./FinancialsFilters";
import { FinancialsTransactionsTable } from "./FinancialsTransactionsTable";

export const dynamic = "force-dynamic";

export default async function FinancialsPage(props: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const session = await requireAdminPagePermission("FINANCIALS");
  const searchParams = await props.searchParams;

  // We'll use 30 days for the overview stats on this page
  const stats = await getAdminRevenueStats(30, session.isSuperAdmin ? null : session.branchSlug);

  const q = typeof searchParams?.q === "string" ? searchParams.q.trim() : "";
  const date = typeof searchParams?.date === "string" ? searchParams.date : "";
  const tab = searchParams?.tab === "all" ? "all" : searchParams?.tab === "cash" ? "cash" : "latest";
  const pageStr = typeof searchParams?.page === "string" ? searchParams.page : "";
  const page = pageStr && !isNaN(Number(pageStr)) ? Math.max(1, Number(pageStr)) : 1;
  const pageSize = 20;

  const searchWhere: any = {};
  if (q) {
    const isNumber = !isNaN(Number(q)) && q !== "";
    if (isNumber) {
      searchWhere.OR = [
        { id: Number(q) },
        { fullName: { contains: q } }
      ];
    } else {
      searchWhere.fullName = { contains: q };
    }
  }

  if (date) {
    const targetDate = new Date(date);
    const endOfDay = new Date(date);
    endOfDay.setHours(23, 59, 59, 999);
    searchWhere.pickupDate = {
      gte: targetDate,
      lte: endOfDay
    };
  }

  const baseWhere: any = session.isSuperAdmin ? {} : {
    OR: [
      { branchId: session.branchId },
      { returnBranchId: session.branchId }
    ]
  };

  const combinedAnd = [baseWhere, searchWhere].filter(x => Object.keys(x).length > 0);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  const paidBookingsThisMonthWhere: any = {
    paymentStatus: "PAID",
    paidAt: { gte: startOfMonth },
  };
  if (combinedAnd.length > 0) {
    paidBookingsThisMonthWhere.AND = combinedAnd;
  }

  const paidBookingsThisMonth = await prisma.bookingRequest.findMany({
    where: paidBookingsThisMonthWhere,
    include: {
      carModel: { select: { price: true, vatRatePercent: true } }
    }
  });

  let bookingsPaidThisMonthTotalSar = 0;
  let cashBookingsThisMonthTotalSar = 0;
  for (const row of paidBookingsThisMonth) {
    if (!row.carModel) continue;
    const { addons, interCityShipping, checkoutOneTimeFees, delayPenalty, couponCode } =
      parseBookingPricingSnapshot(row.addonsJson);

    const effectiveRentalPrice = resolveBookingRentalPricePerDayExclTax(row.carModel.price, row.addonsJson);
    const shipFee = interCityShipping?.feeExclVatSar ?? 0;
    const checkoutFeesSum = checkoutOneTimeFees.reduce((s, x) => s + x.feeExclVatSar, 0);
    const delayFee = delayPenalty?.feeExclVatSar ?? 0;
    const discountExclTax = couponCode?.scope === "FULL_TOTAL" ? couponCode.discountExclTax : 0;

    const totals = computeCheckoutTotals(
      effectiveRentalPrice,
      row.numberOfDays,
      row.carModel.vatRatePercent,
      addons.map((a) => ({ pricePerDay: a.pricePerDayExclTax })),
      { oneTimeFeesExclTax: shipFee + checkoutFeesSum + delayFee, discountExclTax },
    );
    
    bookingsPaidThisMonthTotalSar += totals.totalInclTax;
    if (row.paymentMethod === "CASH") {
      cashBookingsThisMonthTotalSar += totals.totalInclTax;
    }
  }

  const currentMonthName = new Intl.DateTimeFormat('ar-SA', { month: 'long' }).format(new Date());

  // مستحقات قائمة للعملاء (بعد تعديلات قلّصت حجوزات مدفوعة) — تنبيه بأعلى الصفحة.
  const customerDuesWhere: any = {
    refundDueToCustomerSar: { gt: 0 },
    refundDueSettledAt: null,
  };
  if (!session.isSuperAdmin) {
    customerDuesWhere.OR = [
      { branchId: session.branchId },
      { returnBranchId: session.branchId },
    ];
  }
  const customerDuesRows = await prisma.bookingRequest.findMany({
    where: customerDuesWhere,
    select: { refundDueToCustomerSar: true },
  });
  const customerDuesCount = customerDuesRows.length;
  const customerDuesTotalSar = customerDuesRows.reduce(
    (s, r) => s + (r.refundDueToCustomerSar ?? 0),
    0,
  );

  // المركز المالي للمستحقات باتجاهين (للشركة على العملاء / على الشركة للعملاء).
  const duesPosition = await getCompanyDuesPosition({
    isSuperAdmin: session.isSuperAdmin,
    branchId: session.branchId,
  });

  // Fetch recent subscription payments
  const recentSubPayments = session.isSuperAdmin
    ? await prisma.subscriptionPayment.findMany({
      where: { status: "PAID" },
      orderBy: { paidAt: "desc" },
      take: 10,
      include: {
        subscription: {
          include: { user: true, plan: { include: { carModel: { include: { brand: true } } } } }
        }
      }
    })
    : [];

  let recentBookingPayments: any[] = [];
  let totalCount = 0;

  if (tab === "latest") {
    const pendingWhere: any = { paymentStatus: "PENDING" };
    if (combinedAnd.length > 0) {
      pendingWhere.AND = combinedAnd;
    }

    const pendingBookings = await prisma.bookingRequest.findMany({
      where: pendingWhere,
      orderBy: { updatedAt: "desc" },
      include: { customer: true, carModel: { include: { brand: true } } }
    });

    const paidWhere: any = { paymentStatus: { in: ["PAID", "REFUNDED", "PARTIAL_REFUND"] } };
    if (combinedAnd.length > 0) {
      paidWhere.AND = combinedAnd;
    }

    const paidBookings = await prisma.bookingRequest.findMany({
      where: paidWhere,
      orderBy: { updatedAt: "desc" },
      take: combinedAnd.length > 0 ? 50 : 20,
      include: { customer: true, carModel: { include: { brand: true } } }
    });

    recentBookingPayments = [...pendingBookings, ...paidBookings];
    totalCount = recentBookingPayments.length;
    recentBookingPayments = recentBookingPayments.slice((page - 1) * pageSize, page * pageSize);
  } else if (tab === "cash") {
    const cashWhere: any = {
      paymentMethod: "CASH",
      paymentStatus: { in: ["PAID", "REFUNDED", "PARTIAL_REFUND"] }
    };
    if (combinedAnd.length > 0) {
      cashWhere.AND = combinedAnd;
    }

    totalCount = await prisma.bookingRequest.count({ where: cashWhere });
    recentBookingPayments = await prisma.bookingRequest.findMany({
      where: cashWhere,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { customer: true, carModel: { include: { brand: true } } }
    });
  } else {
    const allWhere: any = {
      paymentStatus: { in: ["PENDING", "PAID", "REFUNDED", "PARTIAL_REFUND"] }
    };
    if (combinedAnd.length > 0) {
      allWhere.AND = combinedAnd;
    }

    totalCount = await prisma.bookingRequest.count({ where: allWhere });
    recentBookingPayments = await prisma.bookingRequest.findMany({
      where: allWhere,
      orderBy: { updatedAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
      include: { customer: true, carModel: { include: { brand: true } } }
    });
  }

  const mappedBookingPayments = recentBookingPayments.map(row => {
    let computedTotal = 0;
    if (row.carModel) {
      const { addons, interCityShipping, checkoutOneTimeFees, delayPenalty, couponCode } =
        parseBookingPricingSnapshot(row.addonsJson);
      const effectiveRentalPrice = resolveBookingRentalPricePerDayExclTax(row.carModel.price, row.addonsJson);
      const shipFee = interCityShipping?.feeExclVatSar ?? 0;
      const checkoutFeesSum = checkoutOneTimeFees.reduce((s, x) => s + x.feeExclVatSar, 0);
      const delayFee = delayPenalty?.feeExclVatSar ?? 0;
      const discountExclTax = couponCode?.scope === "FULL_TOTAL" ? couponCode.discountExclTax : 0;
      const totals = computeCheckoutTotals(
        effectiveRentalPrice,
        row.numberOfDays,
        row.carModel.vatRatePercent,
        addons.map((a) => ({ pricePerDay: a.pricePerDayExclTax })),
        { oneTimeFeesExclTax: shipFee + checkoutFeesSum + delayFee, discountExclTax },
      );
      computedTotal = totals.totalInclTax;
    }

    return {
      id: row.id,
      fullName: row.fullName,
      carModel: row.carModel,
      carType: row.carType,
      paymentStatus: row.paymentStatus,
      paymentMethod: row.paymentMethod,
      paidAt: row.paidAt,
      paymentReceivedBy: row.paymentReceivedBy,
      status: row.status,
      pickupDate: row.pickupDate,
      numberOfDays: row.numberOfDays,
      computedTotal,
    };
  });

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="الإدارة المالية"
        description="نظرة عامة على الإيرادات ومدفوعات العملاء للاشتراكات والحجوزات."
        actions={<ReportExportButtons reportId="financial-transactions" withDateRange />}
      />

      {customerDuesCount > 0 ? (
        <Link
          href="/admin/customer-dues"
          className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-sky-300/70 bg-sky-50 px-5 py-4 text-sm font-bold text-sky-950 transition-colors hover:bg-sky-100"
        >
          <span>
            ⚠️ يوجد {customerDuesCount} حجز عليه مستحقات قائمة للعملاء بإجمالي{" "}
            <span className="tabular-nums" dir="ltr">{formatSar(customerDuesTotalSar)} ر.س</span>
            {" "}— بانتظار التسوية.
          </span>
          <span className="rounded-xl bg-[#003749] px-4 py-2 text-xs font-extrabold text-white">
            فتح قسم مستحقات للعميل
          </span>
        </Link>
      ) : null}

      <div className="space-y-3">
        <h2 className="text-sm font-black text-on-surface-variant">المركز المالي للمستحقات</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <AdminStatCard
            label="مستحقات للشركة"
            value={`${formatSar(duesPosition.receivables.totalSar)} ر.س`}
            href="/admin/company-dues"
            highlight={duesPosition.receivables.totalSar > 0}
            hint={`${duesPosition.receivables.count} حجز — رصيد يُحصَّل عند الفرع`}
          />
          <AdminStatCard
            label="مستحقات على الشركة"
            value={`${formatSar(duesPosition.payables.totalSar)} ر.س`}
            href="/admin/customer-dues"
            highlight={duesPosition.payables.totalSar > 0}
            hint={`${duesPosition.payables.count} حجز — استرداد للعملاء بانتظار التسوية`}
          />
          <AdminStatCard
            label="صافي المستحقات"
            value={`${formatSar(duesPosition.netSar)} ر.س`}
            hint={
              duesPosition.netSar >= 0
                ? "لصالح الشركة (المستحق لها أكبر)"
                : "على الشركة (المستحق عليها أكبر)"
            }
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminStatCard
          label={`إجمالي مدفوعات (${currentMonthName})`}
          value={`${formatSar(bookingsPaidThisMonthTotalSar)} ر.س`}
          highlight
          hint={`${paidBookingsThisMonth.length} حجز مدفوع`}
        />
        <AdminStatCard
          label={`مدفوعات الكاش (${currentMonthName})`}
          value={`${formatSar(cashBookingsThisMonthTotalSar)} ر.س`}
          highlight
          hint="إجمالي الدفع النقدي"
        />
        <AdminStatCard
          label="استردادات إلغاء (30 يوماً)"
          value={`${formatSar(stats.refundsTotalSar)} ر.س`}
          hint={`${stats.refundsCount} حالة`}
        />
        <AdminStatCard
          label="حجوزات مدفوعة (30 يوماً)"
          value={stats.bookingPaidCount}
          hint="إيراد الحجز التفصيلي غير مخزّن"
        />
        <AdminStatCard
          label="حجوزات قيد الدفع (30 يوماً)"
          value={stats.bookingPendingCount}
        />
      </div>

      <div className="grid gap-8">
        {/* Subscriptions hidden for now
        <AdminCard title="أحدث مدفوعات الاشتراكات" description="آخر 10 عمليات دفع ناجحة للاشتراكات">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b border-outline-variant/30 text-on-surface-variant text-[11px] font-black uppercase tracking-wider">
                  <th className="pb-3 pr-2">رقم الاشتراك</th>
                  <th className="pb-3">العميل</th>
                  <th className="pb-3">المبلغ</th>
                  <th className="pb-3">الطريقة</th>
                  <th className="pb-3">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {recentSubPayments.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-6 text-center text-on-surface-variant">
                      لا توجد مدفوعات للاشتراكات
                    </td>
                  </tr>
                ) : (
                  recentSubPayments.map((payment) => (
                    <tr key={payment.id} className="transition-colors hover:bg-surface-container/30">
                      <td className="py-3 pr-2 font-bold text-primary">#{payment.subscriptionId}</td>
                      <td className="py-3">{payment.subscription.user.name || payment.subscription.user.email}</td>
                      <td className="py-3 font-bold text-emerald-700">{formatSar(payment.amountSar)} ر.س</td>
                      <td className="py-3 text-[11px] font-black tracking-wide">{payment.paymentMethod || "—"}</td>
                      <td className="py-3 text-on-surface-variant" dir="ltr">
                        {payment.paidAt ? payment.paidAt.toLocaleDateString("ar-SA") : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </AdminCard>
        */}

        <AdminCard title="أحدث المعاملات للحجوزات" description="تظهر حجوزات (الدفع في الفرع - قيد الدفع) بأولوية في الأعلى">
          <div className="mb-6">
            <FinancialsFilters />
          </div>
          <FinancialsTransactionsTable
            bookings={mappedBookingPayments}
            totalCount={totalCount}
            currentPage={page}
            pageSize={pageSize}
            tab={tab as "latest" | "all" | "cash"}
          />
        </AdminCard>
      </div>
    </div>
  );
}
