import { Suspense } from "react";
import Link from "next/link";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import { AdminLabelBreakdown } from "@/components/admin/stats/AdminLabelBreakdown";
import { AdminPeriodSelect } from "@/components/admin/stats/AdminPeriodSelect";
import { AdminTrendPill } from "@/components/admin/stats/AdminTrendPill";
import { requireAdminPage } from "@/lib/admin-page";
import { adminScope } from "@/lib/admin-scope";
import {
  formatSar,
  getAdminBranchStats,
  parseAdminStatsPeriod,
  trendDeltaPct,
} from "@/lib/admin-statistics";

export const dynamic = "force-dynamic";

type Props = { searchParams: Promise<{ days?: string }> };

export default async function AdminStatisticsBranchesPage({ searchParams }: Props) {
  const session = await requireAdminPage();
  const sp = await searchParams;
  const days = parseAdminStatsPeriod(sp.days);
  // موظف الفرع يرى فرعه فقط؛ مشرف المدينة يقارن فروع مدينته؛ غيرهما يقارن كل الفروع
  const stats = await getAdminBranchStats(days, adminScope(session));
  const top = stats.rows[0] ?? null;

  return (
    <>
      <AdminPageHeader
        title="إحصائيات الفروع"
        description="مقارنة تشغيل الفروع: الحجوزات والإيراد والسيارات قيد التشغيل ونسبة استغلال الأسطول — مرتّبة بالأكثر تشغيلاً."
        backHref="/admin/statistics"
        backLabel="الإحصائيات"
        actions={
          <Suspense fallback={<div className="h-10 w-48 animate-pulse rounded-xl bg-surface-container-high" />}>
            <AdminPeriodSelect current={days} />
          </Suspense>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          label="الفرع الأكثر تشغيلاً"
          value={top ? top.name : "—"}
          hint={top ? `${top.bookingsInPeriod} حجزاً خلال ${days} يوماً` : undefined}
          highlight={Boolean(top && top.bookingsInPeriod > 0)}
        />
        <AdminStatCard label="حجوزات الفترة (كل الفروع)" value={stats.totals.bookings} />
        <AdminStatCard
          label="صافي إيراد الفترة"
          value={`${formatSar(stats.totals.revenueSar)} ر.س`}
          hint={
            stats.totals.refundsSar > 0
              ? `مقبوضات ${formatSar(stats.totals.grossSar)} − استردادات ${formatSar(stats.totals.refundsSar)} ر.س`
              : `مقبوضات ${formatSar(stats.totals.grossSar)} ر.س — لا استردادات`
          }
        />
        <AdminStatCard
          label="قيد التشغيل الآن"
          value={`${stats.totals.activeNow} / ${stats.totals.fleetUnits}`}
          hint="سيارة مُسلَّمة ÷ وحدات الأسطول"
        />
      </div>

      {/* جدول الفروع */}
      <AdminCard
        title="ترتيب الفروع حسب التشغيل"
        description={`حجوزات فرع الاستلام خلال آخر ${days} يوماً — الإيراد صافٍ: المقبوضات بتاريخ الدفع ناقص استردادات الإلغاء المنفَّذة في الفترة.`}
      >
        <div className="overflow-x-auto">
          <table className="min-w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-outline-variant/30 text-xs text-on-surface-variant">
                <th className="px-3 py-2.5 text-start font-bold">#</th>
                <th className="px-3 py-2.5 text-start font-bold">الفرع</th>
                <th className="px-3 py-2.5 text-center font-bold">حجوزات الفترة</th>
                <th className="px-3 py-2.5 text-center font-bold">مقارنة بالفترة السابقة</th>
                <th className="px-3 py-2.5 text-center font-bold">مدفوعة</th>
                <th className="px-3 py-2.5 text-center font-bold">المقبوضات (ر.س)</th>
                <th className="px-3 py-2.5 text-center font-bold">استردادات (ر.س)</th>
                <th className="px-3 py-2.5 text-center font-bold">صافي الإيراد (ر.س)</th>
                <th className="px-3 py-2.5 text-center font-bold">قيد التشغيل</th>
                <th className="px-3 py-2.5 text-center font-bold">الأسطول</th>
                <th className="px-3 py-2.5 text-center font-bold">نسبة التشغيل</th>
                <th className="px-3 py-2.5 text-start font-bold">الأكثر طلباً</th>
              </tr>
            </thead>
            <tbody>
              {stats.rows.map((r, i) => (
                <tr
                  key={r.branchId}
                  className="border-b border-outline-variant/15 last:border-0 hover:bg-surface-container-low/40"
                >
                  <td className="px-3 py-3 font-black tabular-nums text-on-surface-variant">
                    {i + 1}
                  </td>
                  <td className="px-3 py-3">
                    <Link
                      href={`/admin/statistics/branches/${r.branchId}?days=${days}`}
                      className="group/link inline-flex items-center gap-1.5"
                    >
                      <span className="font-extrabold text-primary group-hover/link:underline">
                        {r.name}
                      </span>
                      <span aria-hidden className="text-xs text-primary/60">←</span>
                    </Link>
                    {r.cityName ? (
                      <span className="block text-[11px] font-medium text-on-surface-variant">
                        {r.cityName}
                      </span>
                    ) : null}
                  </td>
                  <td className="px-3 py-3 text-center text-base font-extrabold tabular-nums text-on-surface">
                    {r.bookingsInPeriod}
                  </td>
                  <td className="px-3 py-3 text-center">
                    <AdminTrendPill
                      deltaPct={trendDeltaPct(r.bookingsInPeriod, r.bookingsPrevPeriod)}
                    />
                  </td>
                  <td className="px-3 py-3 text-center font-bold tabular-nums">{r.paidInPeriod}</td>
                  <td className="px-3 py-3 text-center font-bold tabular-nums">
                    {r.grossSar > 0 ? (
                      formatSar(r.grossSar)
                    ) : (
                      <span className="text-on-surface-variant/50">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center font-bold tabular-nums">
                    {r.refundsSar > 0 ? (
                      <span className="text-error">−{formatSar(r.refundsSar)}</span>
                    ) : (
                      <span className="text-on-surface-variant/50">—</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-center font-bold tabular-nums text-primary">
                    {formatSar(r.revenueSar)}
                  </td>
                  <td className="px-3 py-3 text-center font-bold tabular-nums">{r.activeNow}</td>
                  <td className="px-3 py-3 text-center font-bold tabular-nums">{r.fleetUnits}</td>
                  <td className="px-3 py-3 text-center">
                    <span
                      className={`inline-block rounded-full px-2.5 py-1 text-xs font-black tabular-nums ${
                        r.utilizationPct >= 70
                          ? "bg-emerald-100 text-emerald-800"
                          : r.utilizationPct >= 30
                            ? "bg-amber-100 text-amber-800"
                            : "bg-surface-container-high text-on-surface-variant"
                      }`}
                    >
                      {r.utilizationPct}%
                    </span>
                  </td>
                  <td className="px-3 py-3 text-xs font-bold text-on-surface">
                    {r.topModelLabel ? (
                      <>
                        {r.topModelLabel}
                        <span className="mx-1 text-on-surface-variant">·</span>
                        <span className="tabular-nums text-on-surface-variant">
                          {r.topModelCount}
                        </span>
                      </>
                    ) : (
                      <span className="text-on-surface-variant/60">—</span>
                    )}
                  </td>
                </tr>
              ))}
              {stats.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={12}
                    className="px-3 py-8 text-center text-sm font-medium text-on-surface-variant"
                  >
                    لا توجد فروع نشطة.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
        {stats.unassignedBookings > 0 ? (
          <p className="mt-4 text-[11px] font-medium text-on-surface-variant">
            {stats.unassignedBookings} حجزاً في الفترة بدون فرع استلام (توصيل أو استفسارات) — غير
            مشمولة في الترتيب أعلاه.
          </p>
        ) : null}
      </AdminCard>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <AdminCard title="توزيع حجوزات الفترة على الفروع">
          <AdminLabelBreakdown items={stats.bookingsSplit} accent="#775927" />
        </AdminCard>
        <AdminCard
          title="توزيع صافي إيراد الفترة على الفروع"
          description="القيم بالريال شاملة الضريبة، بعد خصم استردادات الإلغاء"
        >
          <AdminLabelBreakdown items={stats.revenueSplit} accent="#0f766e" />
        </AdminCard>
      </div>
    </>
  );
}
