import { Suspense } from "react";
import Link from "next/link";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import { AdminBarChart } from "@/components/admin/stats/AdminBarChart";
import { AdminLabelBreakdown } from "@/components/admin/stats/AdminLabelBreakdown";
import { AdminPeriodSelect } from "@/components/admin/stats/AdminPeriodSelect";
import { AdminTrendPill } from "@/components/admin/stats/AdminTrendPill";
import { requireAdminPage } from "@/lib/admin-page";
import { adminScope } from "@/lib/admin-scope";
import {
  getAdminOverviewStats,
  parseAdminStatsPeriod,
  trendDeltaPct,
} from "@/lib/admin-statistics";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ days?: string }> };

export default async function AdminStatisticsOverviewPage({ searchParams }: Props) {
  const session = await requireAdminPage();
  const sp = await searchParams;
  const days = parseAdminStatsPeriod(sp.days);
  const stats = await getAdminOverviewStats(days, adminScope(session));
  const bookingDelta = trendDeltaPct(stats.bookingsInPeriod, stats.bookingsPrevPeriod);

  return (
    <>
      <AdminPageHeader
        title="إحصائيات — نظرة عامة"
        description="ملخص نشاط الحجوزات والاشتراكات والأسطول خلال الفترة المحددة."
        backHref="/admin"
        actions={
          <Suspense fallback={<div className="h-10 w-48 animate-pulse rounded-xl bg-surface-container-high" />}>
            <AdminPeriodSelect current={days} />
          </Suspense>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <AdminTrendPill deltaPct={bookingDelta} />
        <span className="text-xs font-medium text-on-surface-variant">
          الفترة: آخر {days} يوماً
        </span>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          label="حجوزات الفترة"
          value={stats.bookingsInPeriod}
          href="/admin/statistics/bookings"
          highlight={stats.newInquiries > 0}
          hint={stats.newInquiries > 0 ? `${stats.newInquiries} استفسار جديد` : undefined}
        />
        <AdminStatCard label="مدفوعة" value={stats.paidInPeriod} />
        <AdminStatCard label="حجز مباشر" value={stats.directInPeriod} />
        <AdminStatCard
          label="طلبات شركات"
          value={stats.corporateLeadsInPeriod}
          href="/admin/corporate-leads"
        />
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          label="اشتراكات نشطة"
          value={stats.activeSubscriptions}
          href="/admin/subscriptions"
        />
        <AdminStatCard label="وحدات الأسطول" value={stats.fleetUnits} href="/admin/statistics/fleet" />
        <AdminStatCard label="حسابات عملاء" value={stats.customersWithAccounts} href="/admin/customers" />
        <AdminStatCard
          label="تفاصيل الإيرادات"
          value="→"
          href="/admin/statistics/revenue"
          hint="اشتراكات ومدفوعات"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <AdminCard
          title="اتجاه الحجوزات اليومي"
          description="عدد طلبات الحجز المسجّلة كل يوم"
          className="lg:col-span-3"
        >
          <AdminBarChart data={stats.bookingTrend} height={200} accent="#775927" />
        </AdminCard>

        <AdminCard title="نوع الطلب" className="lg:col-span-2">
          <AdminLabelBreakdown items={stats.kindSplit} accent="#003749" />
        </AdminCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <AdminCard title="حالة الدفع (حجوزات الفترة)">
          <AdminLabelBreakdown items={stats.paymentSplit} accent="#9a3412" />
        </AdminCard>

        <AdminCard title="روابط سريعة">
          <ul className="space-y-2 text-sm font-bold">
            <li>
              <Link href="/admin/car-bookings" className="text-primary hover:underline">
                إدارة حجوزات السيارات
              </Link>
            </li>
            <li>
              <Link href="/admin/statistics/bookings" className="text-primary hover:underline">
                تقرير الحجوزات التفصيلي
              </Link>
            </li>
            <li>
              <Link href="/admin/fleet-availability" className="text-primary hover:underline">
                توفر المركبات
              </Link>
            </li>
          </ul>
        </AdminCard>
      </div>
    </>
  );
}
