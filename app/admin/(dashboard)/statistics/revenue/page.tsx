import { Suspense } from "react";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import { AdminBarChart } from "@/components/admin/stats/AdminBarChart";
import { AdminLabelBreakdown } from "@/components/admin/stats/AdminLabelBreakdown";
import { AdminPeriodSelect } from "@/components/admin/stats/AdminPeriodSelect";
import { requireAdminPage } from "@/lib/admin-page";
import {
  formatSar,
  getAdminRevenueStats,
  parseAdminStatsPeriod,
} from "@/lib/admin-statistics";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ days?: string }> };

export default async function AdminStatisticsRevenuePage({ searchParams }: Props) {
  const session = await requireAdminPage();
  const sp = await searchParams;
  const days = parseAdminStatsPeriod(sp.days);
  const stats = await getAdminRevenueStats(
    days,
    session.isSuperAdmin ? null : session.branchSlug,
  );

  return (
    <>
      <AdminPageHeader
        title="إحصائيات الإيرادات"
        description="مدفوعات اشتراكات العملاء (ر.س) وحالات دفع الحجوزات واستردادات الإلغاء. إيراد الحجز التفصيلي غير مخزّن في النظام حالياً."
        backHref="/admin/statistics"
        backLabel="الإحصائيات"
        actions={
          <Suspense fallback={<div className="h-10 w-48 animate-pulse rounded-xl bg-surface-container-high" />}>
            <AdminPeriodSelect current={days} />
          </Suspense>
        }
      />

      <p className="mb-6 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 text-sm font-medium leading-relaxed text-amber-950">
        المبالغ المعروضة للاشتراكات من جدول مدفوعات الاشتراك (حالة مدفوع). أعداد الحجوزات «مدفوعة» تعكس
        حالة الدفع وليس إجمالي مبلغ الحجز.
      </p>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminStatCard
          label="اشتراكات مدفوعة"
          value={`${formatSar(stats.subscriptionPaidTotalSar)} ر.س`}
          highlight
          hint={`${stats.subscriptionPaidCount} عملية دفع`}
        />
        <AdminStatCard label="حجوزات مدفوعة" value={stats.bookingPaidCount} />
        <AdminStatCard label="حجوزات قيد الدفع" value={stats.bookingPendingCount} />
        <AdminStatCard
          label="استردادات إلغاء"
          value={`${formatSar(stats.refundsTotalSar)} ر.س`}
          hint={`${stats.refundsCount} حالة`}
        />
      </div>

      <AdminCard
        title="مدفوعات اشتراك يومياً (عدد العمليات)"
        description={`آخر ${days} يوماً`}
        className="mb-6"
      >
        <AdminBarChart
          data={stats.subscriptionTrend}
          height={220}
          accent="#9a3412"
          emptyLabel="لا مدفوعات اشتراك في هذه الفترة"
        />
      </AdminCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <AdminCard title="حالات اشتراكات العملاء (كل الوقت)">
          <AdminLabelBreakdown items={stats.bySubscriptionStatus} accent="#775927" />
        </AdminCard>
        <AdminCard title="مدفوعات الاشتراك حسب الطريقة (ر.س)">
          <AdminLabelBreakdown
            items={stats.subscriptionPaymentsByMethod}
            accent="#003749"
            showCount={false}
          />
        </AdminCard>
      </div>
    </>
  );
}
