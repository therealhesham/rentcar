import { Suspense } from "react";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import { AdminBarChart } from "@/components/admin/stats/AdminBarChart";
import { AdminLabelBreakdown } from "@/components/admin/stats/AdminLabelBreakdown";
import { AdminPeriodSelect } from "@/components/admin/stats/AdminPeriodSelect";
import { requireAdminPage } from "@/lib/admin-page";
import { adminScope } from "@/lib/admin-scope";
import {
  getAdminBookingStats,
  parseAdminStatsPeriod,
} from "@/lib/admin-statistics";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ days?: string }> };

export default async function AdminStatisticsBookingsPage({ searchParams }: Props) {
  const session = await requireAdminPage();
  const sp = await searchParams;
  const days = parseAdminStatsPeriod(sp.days);
  const stats = await getAdminBookingStats(days, adminScope(session));

  return (
    <>
      <AdminPageHeader
        title="إحصائيات الحجوزات"
        description="توزيع الحالات والفروع وطرق الاستلام والدفع، وأكثر الموديلات طلباً."
        backHref="/admin/statistics"
        backLabel="الإحصائيات"
        actions={
          <Suspense fallback={<div className="h-10 w-48 animate-pulse rounded-xl bg-surface-container-high" />}>
            <AdminPeriodSelect current={days} />
          </Suspense>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminStatCard label="إجمالي الطلبات" value={stats.total} highlight />
        <AdminStatCard label="متوسط أيام التأجير" value={stats.avgRentalDays} hint="تقريب لأقرب يوم" />
        <AdminStatCard
          label="أعلى فرع"
          value={stats.byBranch[0]?.count ?? "—"}
          hint={stats.byBranch[0]?.label}
        />
        <AdminStatCard
          label="أكثر موديل"
          value={stats.topModels[0]?.count ?? "—"}
          hint={stats.topModels[0]?.label}
        />
      </div>

      <AdminCard
        title="الحجوزات يومياً"
        description={`آخر ${days} يوماً`}
        className="mb-6"
      >
        <AdminBarChart data={stats.trend} height={220} accent="#003749" />
      </AdminCard>

      <div className="grid gap-6 lg:grid-cols-2">
        <AdminCard title="حسب الحالة">
          <AdminLabelBreakdown items={stats.byStatus} accent="#775927" />
        </AdminCard>
        <AdminCard title="طريقة الاستلام">
          <AdminLabelBreakdown items={stats.byPickupMode} accent="#003749" />
        </AdminCard>
        <AdminCard title="الفروع (أعلى 10)">
          <AdminLabelBreakdown items={stats.byBranch} accent="#9a3412" />
        </AdminCard>
        <AdminCard title="طريقة الدفع">
          <AdminLabelBreakdown items={stats.byPaymentMethod} accent="#5b21b6" />
        </AdminCard>
      </div>

      <AdminCard title="أكثر الموديلات طلباً" className="mt-6">
        <AdminLabelBreakdown items={stats.topModels} accent="#0f766e" />
      </AdminCard>
    </>
  );
}
