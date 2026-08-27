import type { Prisma } from "@prisma/client";
import { requireAdminPage } from "@/lib/admin-page";
import { adminScope, bookingWhereForScope } from "@/lib/admin-scope";
import { ReportExportButtons } from "@/components/admin/ReportExportButtons";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import { formatSar, formatCount } from "@/lib/admin-statistics";
import { bookingPaymentMethodLabelAr } from "@/lib/booking-payment-method-label";
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
  const session = await requireAdminPage();
  const searchParams = await props.searchParams;

  const scope = adminScope(session);

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

  const baseWhere: Prisma.BookingRequestWhereInput = bookingWhereForScope(scope);

  const combinedAnd = [baseWhere, searchWhere].filter(x => Object.keys(x).length > 0);

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);

  // بطاقات الملخّص تتبع نطاق الموظف فقط — بحث الجدول بالأسفل لا يغيّرها.
  const scopeAnd = Object.keys(baseWhere).length > 0 ? [baseWhere] : [];

  // استعلامات الشهر: المبالغ من دفتر PaymentTransaction (المحصَّل فعلاً)،
  // والأعداد من BookingRequest حسب تاريخ الإنشاء.
  const monthCreatedWhere = (extra: Prisma.BookingRequestWhereInput) => ({
    createdAt: { gte: startOfMonth },
    ...extra,
    ...(scopeAnd.length > 0 ? { AND: scopeAnd } : {}),
  });

  const [monthTxns, monthPaidCount, monthPendingCount] = await Promise.all([
    prisma.paymentTransaction.findMany({
      where: {
        status: "COMPLETED",
        createdAt: { gte: startOfMonth },
        booking: baseWhere,
      },
      select: { direction: true, amountSar: true, method: true, actorKind: true },
    }),
    prisma.bookingRequest.count({ where: monthCreatedWhere({ paymentStatus: "PAID" }) }),
    prisma.bookingRequest.count({ where: monthCreatedWhere({ paymentStatus: "PENDING" }) }),
  ]);

  /**
   * تقسيم المحصَّل حسب **من نفّذ العملية** لا حسب اسم الوسيلة:
   * - GATEWAY (تأكيد webhook جيديا/تابي) و CUSTOMER (دفع العميل من الموقع) → أونلاين.
   * - ADMIN (موظف سجّل التحصيل) → تحصيل في الفرع، حتى لو كانت الوسيلة «مدى»
   *   عبر جهاز نقاط البيع — وهي الحالة التي كان التقسيم باسم الوسيلة يخطئ فيها.
   */
  type Bucket = { totalSar: number; count: number; byMethod: Map<string, number> };
  const newBucket = (): Bucket => ({ totalSar: 0, count: 0, byMethod: new Map() });
  const collected = newBucket();
  const collectedOnline = newBucket();
  const collectedBranch = newBucket();
  const refunded = newBucket();

  const addToBucket = (b: Bucket, amountSar: number, method: string | null) => {
    b.totalSar += amountSar;
    b.count += 1;
    const label = bookingPaymentMethodLabelAr(method);
    b.byMethod.set(label, (b.byMethod.get(label) ?? 0) + 1);
  };

  for (const t of monthTxns) {
    if (t.direction === "DEBIT") {
      addToBucket(refunded, t.amountSar, t.method);
      continue;
    }
    addToBucket(collected, t.amountSar, t.method);
    addToBucket(
      t.actorKind === "ADMIN" ? collectedBranch : collectedOnline,
      t.amountSar,
      t.method,
    );
  }

  const round2 = (n: number) => Math.round(n * 100) / 100;
  const methodsHint = (b: Bucket) =>
    [...b.byMethod.entries()]
      .sort((a, c) => c[1] - a[1])
      .map(([label, count]) => `${label} ${formatCount(count)}`)
      .join(" · ");

  const netMovementSar = round2(collected.totalSar - refunded.totalSar);

  const currentMonthName = new Intl.DateTimeFormat('ar-SA', { month: 'long' }).format(new Date());

  // مستحقات قائمة للعملاء (بعد تعديلات قلّصت حجوزات مدفوعة) — تنبيه بأعلى الصفحة.
  const customerDuesWhere: any = {
    refundDueToCustomerSar: { gt: 0 },
    refundDueSettledAt: null,
  };
  if (Object.keys(baseWhere).length > 0) {
    customerDuesWhere.AND = [baseWhere];
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
  const duesPosition = await getCompanyDuesPosition(scope);

  // Fetch recent subscription payments
  // الاشتراكات غير مرتبطة بفرع — تُعرض لمن نطاقه كل الفروع فقط.
  const recentSubPayments = scope.kind === "all"
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
            ⚠️ يوجد {formatCount(customerDuesCount)} حجز عليه مستحقات قائمة للعملاء بإجمالي{" "}
            <span className="tabular-nums" dir="ltr">{formatSar(customerDuesTotalSar)} ر.س</span>
            {" "}— بانتظار التسوية.
          </span>
          <span className="rounded-xl bg-[#003749] px-4 py-2 text-xs font-extrabold text-white">
            فتح قسم مستحقات للعميل
          </span>
        </Link>
      ) : null}

      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-black text-on-surface-variant">المركز المالي للمستحقات</h2>
          <p className="mt-1 text-xs font-medium text-on-surface-variant/80">
            أرصدة قائمة غير مرتبطة بفترة زمنية — تشمل كل الحجوزات المفتوحة مهما كان تاريخها.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <AdminStatCard
            label="مستحقات للشركة"
            value={`${formatSar(duesPosition.receivables.totalSar)} ر.س`}
            href="/admin/company-dues"
            highlight={duesPosition.receivables.totalSar > 0}
            hint={`${formatCount(duesPosition.receivables.count)} حجز — رصيد يُحصَّل عند الفرع`}
          />
          <AdminStatCard
            label="مستحقات على الشركة"
            value={`${formatSar(duesPosition.payables.totalSar)} ر.س`}
            href="/admin/customer-dues"
            highlight={duesPosition.payables.totalSar > 0}
            hint={`${formatCount(duesPosition.payables.count)} حجز — استرداد للعملاء بانتظار التسوية`}
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

      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-black text-on-surface-variant">
            حركة الأموال خلال {currentMonthName}
          </h2>
          <p className="mt-1 text-xs font-medium text-on-surface-variant/80">
            مبالغ فعلية من دفتر العمليات، من أول {currentMonthName} حتى اليوم حسب تاريخ العملية.
            «البوابة» و«الفرع» جزءان من المحصَّل وليسا إضافة عليه. صافي الحركة:{" "}
            <span className="font-black text-on-surface" dir="ltr">
              {formatSar(netMovementSar)} ر.س
            </span>
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <AdminStatCard
            label="إجمالي المحصَّل"
            value={`${formatSar(round2(collected.totalSar))} ر.س`}
            highlight
            hint={`${formatCount(collected.count)} عملية = البوابة + الفرع`}
          />
          <AdminStatCard
            label="منه: عبر البوابة (أونلاين)"
            value={`${formatSar(round2(collectedOnline.totalSar))} ر.س`}
            hint={
              collectedOnline.count > 0
                ? `${formatCount(collectedOnline.count)} عملية — ${methodsHint(collectedOnline)}`
                : "لا توجد مدفوعات عبر البوابة هذا الشهر"
            }
          />
          <AdminStatCard
            label="منه: تحصيل في الفرع"
            value={`${formatSar(round2(collectedBranch.totalSar))} ر.س`}
            hint={
              collectedBranch.count > 0
                ? `${formatCount(collectedBranch.count)} عملية — ${methodsHint(collectedBranch)}`
                : "لا توجد تحصيلات في الفرع هذا الشهر"
            }
          />
          <AdminStatCard
            label="مبالغ خرجت للعملاء"
            value={`${formatSar(round2(refunded.totalSar))} ر.س`}
            hint={
              refunded.count > 0
                ? `${formatCount(refunded.count)} عملية — استرداد أو تسوية نُفِّذت هذا الشهر`
                : "لا توجد استردادات هذا الشهر"
            }
          />
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-black text-on-surface-variant">
            حجوزات أُنشئت خلال {currentMonthName}
          </h2>
          <p className="mt-1 text-xs font-medium text-on-surface-variant/80">
            عدد الحجوزات حسب تاريخ إنشائها — لا حسب تاريخ الدفع، لذلك قد تختلف عن العدد أعلاه.
          </p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <AdminStatCard
            label="حجوزات مدفوعة"
            value={formatCount(monthPaidCount)}
            hint="اكتمل دفع إجماليها"
          />
          <AdminStatCard
            label="حجوزات قيد الدفع"
            value={formatCount(monthPendingCount)}
            hint="لم يكتمل دفعها بعد — منها فقط الحجوزات المباشرة تُحتسب ضمن «مستحقات للشركة»"
          />
        </div>
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
