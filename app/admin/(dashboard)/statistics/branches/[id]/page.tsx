import { Suspense } from "react";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import { AdminBarChart } from "@/components/admin/stats/AdminBarChart";
import { AdminLabelBreakdown } from "@/components/admin/stats/AdminLabelBreakdown";
import { AdminPeriodSelect } from "@/components/admin/stats/AdminPeriodSelect";
import { AdminTrendPill } from "@/components/admin/stats/AdminTrendPill";
import { requireAdminPage } from "@/lib/admin-page";
import { adminScope, isBranchIdInScope } from "@/lib/admin-scope";
import {
  formatSar,
  getAdminBranchDetailStats,
  parseAdminStatsPeriod,
  trendDeltaPct,
} from "@/lib/admin-statistics";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ days?: string }>;
};

const DATE_FMT = new Intl.DateTimeFormat("ar-SA-u-nu-latn", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

export default async function AdminBranchDetailStatsPage({ params, searchParams }: Props) {
  const session = await requireAdminPage();
  const [{ id: idRaw }, sp] = await Promise.all([params, searchParams]);
  const branchId = Number(idRaw);
  if (!Number.isInteger(branchId) || branchId < 1) notFound();

  // فرع خارج النطاق (فرع آخر، أو فرع خارج مدينة المشرف) لا تُعرض تفاصيله
  if (!(await isBranchIdInScope(adminScope(session), branchId))) {
    redirect("/admin/statistics/branches");
  }

  const days = parseAdminStatsPeriod(sp.days);
  const stats = await getAdminBranchDetailStats(branchId, days);
  if (!stats) notFound();

  const delta = trendDeltaPct(stats.bookingsInPeriod, stats.bookingsPrevPeriod);

  return (
    <>
      <AdminPageHeader
        title={`فرع ${stats.branch.name}`}
        description={`${stats.branch.cityName ? `${stats.branch.cityName} — ` : ""}تفاصيل التشغيل خلال آخر ${days} يوماً: الحجوزات محسوبة بفرع الاستلام، والإيراد بتاريخ الدفع الفعلي.`}
        backHref="/admin/statistics/branches"
        backLabel="إحصائيات الفروع"
        actions={
          <Suspense fallback={<div className="h-10 w-48 animate-pulse rounded-xl bg-surface-container-high" />}>
            <AdminPeriodSelect current={days} />
          </Suspense>
        }
      />

      <div className="mb-6 flex flex-wrap items-center gap-3">
        <AdminTrendPill deltaPct={delta} />
        <span className="text-xs font-medium text-on-surface-variant">
          مقارنة حجوزات الفترة بالفترة السابقة
        </span>
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="حجوزات الفترة" value={stats.bookingsInPeriod} />
        <AdminStatCard
          label="صافي إيراد الفترة"
          value={`${formatSar(stats.revenueSar)} ر.س`}
          hint={
            stats.refundsSar > 0
              ? `مقبوضات ${formatSar(stats.grossSar)} − استردادات ${formatSar(stats.refundsSar)} ر.س (${stats.paidInPeriod} مدفوعاً)`
              : `مقبوضات ${formatSar(stats.grossSar)} ر.س — لا استردادات (${stats.paidInPeriod} مدفوعاً)`
          }
        />
        <AdminStatCard
          label="قيد التشغيل الآن"
          value={`${stats.activeNow} / ${stats.fleetUnits}`}
          hint={`نسبة التشغيل ${stats.utilizationPct}%`}
          highlight={stats.utilizationPct >= 70}
        />
        <AdminStatCard
          label="إرجاعات إلى الفرع"
          value={stats.returnsInPeriod}
          hint="سيارات أُرجعت لهذا الفرع خلال الفترة"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-5">
        <AdminCard
          title="اتجاه الحجوزات اليومي"
          description="طلبات الحجز المسجّلة على هذا الفرع كل يوم"
          className="lg:col-span-3"
        >
          <AdminBarChart data={stats.trend} height={200} accent="#775927" />
        </AdminCard>

        <AdminCard title="الأكثر طلباً في الفرع" className="lg:col-span-2">
          <AdminLabelBreakdown items={stats.topModels} accent="#0f766e" />
        </AdminCard>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <AdminCard title="حالة الحجوزات (الفترة)">
          <AdminLabelBreakdown items={stats.byStatus} accent="#003749" />
        </AdminCard>
        <AdminCard title="حالة الدفع (الفترة)">
          <AdminLabelBreakdown items={stats.byPayment} accent="#9a3412" />
        </AdminCard>
      </div>

      <AdminCard
        title="أسطول الفرع"
        description="الكمية والسعر اليومي الفعلي (دون ضريبة) — «سعر خاص» يعني تجاوزاً لسعر الموديل الأساسي"
        className="mt-6"
      >
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-outline-variant/30 text-xs text-on-surface-variant">
                <th className="px-3 py-2.5 text-start font-bold">الموديل</th>
                <th className="px-3 py-2.5 text-center font-bold">الكمية</th>
                <th className="px-3 py-2.5 text-center font-bold">سعر اليوم (ر.س)</th>
                <th className="px-3 py-2.5 text-center font-bold">التسعير</th>
              </tr>
            </thead>
            <tbody>
              {stats.fleetModels.map((m) => (
                <tr
                  key={m.modelId}
                  className="border-b border-outline-variant/15 last:border-0 hover:bg-surface-container-low/40"
                >
                  <td className="px-3 py-2.5 font-bold text-on-surface">{m.label}</td>
                  <td className="px-3 py-2.5 text-center font-bold tabular-nums">{m.quantity}</td>
                  <td className="px-3 py-2.5 text-center font-bold tabular-nums text-primary">
                    {formatSar(m.priceExclTax)}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {m.hasBranchPrice ? (
                      <span className="inline-block rounded-full bg-primary/10 px-2.5 py-1 text-[11px] font-black text-primary">
                        سعر خاص بالفرع
                      </span>
                    ) : (
                      <span className="text-[11px] font-bold text-on-surface-variant">
                        سعر الموديل
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {stats.fleetModels.length === 0 ? (
                <tr>
                  <td
                    colSpan={4}
                    className="px-3 py-8 text-center text-sm font-medium text-on-surface-variant"
                  >
                    لا يوجد مخزون مسجّل لهذا الفرع.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </AdminCard>

      <AdminCard
        title="أحدث الحجوزات على الفرع"
        description="آخر 8 طلبات (كل الفترات) — اضغط رقم الحجز للتفاصيل"
        className="mt-6"
      >
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-outline-variant/30 text-xs text-on-surface-variant">
                <th className="px-3 py-2.5 text-start font-bold">الحجز</th>
                <th className="px-3 py-2.5 text-start font-bold">العميل</th>
                <th className="px-3 py-2.5 text-start font-bold">السيارة</th>
                <th className="px-3 py-2.5 text-center font-bold">الحالة</th>
                <th className="px-3 py-2.5 text-center font-bold">الدفع</th>
                <th className="px-3 py-2.5 text-center font-bold">الإجمالي (ر.س)</th>
                <th className="px-3 py-2.5 text-start font-bold">التاريخ</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentBookings.map((b) => (
                <tr
                  key={b.id}
                  className="border-b border-outline-variant/15 last:border-0 hover:bg-surface-container-low/40"
                >
                  <td className="px-3 py-2.5">
                    <Link
                      href={`/admin/bookings/${b.id}`}
                      className="font-black tabular-nums text-primary hover:underline"
                    >
                      #{b.id}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 font-bold text-on-surface">{b.fullName}</td>
                  <td className="px-3 py-2.5 text-xs font-bold text-on-surface-variant">
                    {b.carModelLabel ?? "—"}
                  </td>
                  <td className="px-3 py-2.5 text-center text-xs font-bold">{b.statusLabel}</td>
                  <td className="px-3 py-2.5 text-center text-xs font-bold">{b.paymentLabel}</td>
                  <td className="px-3 py-2.5 text-center font-bold tabular-nums">
                    {b.totalSar != null ? formatSar(b.totalSar) : "—"}
                  </td>
                  <td className="px-3 py-2.5 text-xs font-medium text-on-surface-variant" dir="ltr">
                    {DATE_FMT.format(b.createdAt)}
                  </td>
                </tr>
              ))}
              {stats.recentBookings.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    className="px-3 py-8 text-center text-sm font-medium text-on-surface-variant"
                  >
                    لا توجد حجوزات على هذا الفرع بعد.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </>
  );
}
