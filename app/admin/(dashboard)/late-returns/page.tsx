import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-page";
import { adminScope, bookingWhereForScope } from "@/lib/admin-scope";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import { formatSar } from "@/lib/admin-statistics";
import { computeBookingReturnAt } from "@/lib/booking-return-schedule";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const WHEN_FMT = new Intl.DateTimeFormat("ar-SA-u-nu-latn", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Asia/Riyadh",
});

function fmtWhen(d: Date | null): string {
  return d ? WHEN_FMT.format(d) : "—";
}

export default async function AdminLateReturnsPage() {
  const session = await requireAdminPage();

  const scopeWhere = bookingWhereForScope(adminScope(session));

  const rows = await prisma.bookingRequest.findMany({
    where: { ...scopeWhere, lateReturnHours: { not: null } },
    orderBy: { vehicleReturnedAt: "desc" },
    include: {
      carModel: { include: { brand: true } },
      pickupBranch: { select: { name: true } },
    },
  });

  const applied = rows.filter(
    (r) => (r.lateReturnPenaltyExclTaxSar ?? 0) > 0 && !r.lateReturnPenaltyWaived,
  );
  const waived = rows.filter((r) => r.lateReturnPenaltyWaived);
  const outstanding = applied.filter((r) => (r.balanceDueAtBranchSar ?? 0) > 0);
  const appliedTotalExcl = applied.reduce(
    (s, r) => s + (r.lateReturnPenaltyExclTaxSar ?? 0),
    0,
  );
  const outstandingTotal = outstanding.reduce(
    (s, r) => s + (r.balanceDueAtBranchSar ?? 0),
    0,
  );

  return (
    <div className="space-y-8 pb-10">
      <AdminPageHeader
        title="الاستلامات المتأخرة"
        description="كل إرجاع سُجِّل متأخراً عن موعد الحجز (بعد سماحية الساعتين): الغرامة المطبقة أو المُعفاة، ومتابعة تحصيلها."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard label="إرجاعات متأخرة" value={rows.length} />
        <AdminStatCard
          label="غرامات مطبقة"
          value={`${formatSar(Math.round(appliedTotalExcl * 100) / 100)} ر.س`}
          hint={`${applied.length} غرامة (قبل الضريبة)`}
        />
        <AdminStatCard
          label="بانتظار التحصيل"
          value={`${formatSar(Math.round(outstandingTotal * 100) / 100)} ر.س`}
          highlight={outstandingTotal > 0}
          hint={`${outstanding.length} غرامة لم تُحصَّل (شاملة الضريبة)`}
        />
        <AdminStatCard label="إعفاءات" value={waived.length} hint="أُعفي العميل من الغرامة" />
      </div>

      <AdminCard
        title="سجل الإرجاعات المتأخرة"
        description="الغرامة تُحسب على إجمالي التأخير من الموعد الأساسي بعد خصم بند الساعات المدفوع مسبقاً عند الحجز. «بانتظار التحصيل» يُسدَّد من صفحة العمليات المالية للحجز."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b border-outline-variant/30 text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                <th className="pb-3 pr-2">الحجز</th>
                <th className="pb-3">العميل</th>
                <th className="pb-3">السيارة / الفرع</th>
                <th className="pb-3">الموعد المجدول</th>
                <th className="pb-3">الإرجاع الفعلي</th>
                <th className="pb-3">التأخير</th>
                <th className="pb-3">الغرامة</th>
                <th className="pb-3">القرار بواسطة</th>
                <th className="pb-3">حالة التحصيل</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-8 text-center text-on-surface-variant">
                    لا توجد إرجاعات متأخرة مسجّلة بعد.
                  </td>
                </tr>
              ) : (
                rows.map((r) => {
                  const penaltyExcl = r.lateReturnPenaltyExclTaxSar ?? 0;
                  const isWaived = r.lateReturnPenaltyWaived;
                  const isApplied = penaltyExcl > 0 && !isWaived;
                  const stillDue = isApplied && (r.balanceDueAtBranchSar ?? 0) > 0;
                  return (
                    <tr key={r.id} className="transition-colors hover:bg-surface-container/30">
                      <td className="py-3 pr-2">
                        <Link
                          href={`/admin/bookings/${r.id}`}
                          className="font-bold text-primary hover:underline"
                          dir="ltr"
                        >
                          #{r.id}
                        </Link>
                      </td>
                      <td className="py-3">
                        <div className="font-bold text-on-surface">{r.fullName}</div>
                        <div className="text-xs text-on-surface-variant" dir="ltr">
                          {r.phone}
                        </div>
                      </td>
                      <td className="py-3 text-xs">
                        <div className="font-bold text-on-surface">
                          {r.carModel
                            ? `${r.carModel.brand.name} ${r.carModel.name}`.trim()
                            : "—"}
                        </div>
                        <div className="text-on-surface-variant">
                          {r.pickupBranch?.name ?? "—"}
                        </div>
                      </td>
                      <td className="py-3 text-xs text-on-surface-variant" dir="ltr">
                        {fmtWhen(computeBookingReturnAt(r.pickupDate, r.numberOfDays))}
                      </td>
                      <td className="py-3 text-xs text-on-surface-variant" dir="ltr">
                        {fmtWhen(r.vehicleReturnedAt)}
                      </td>
                      <td className="py-3 font-extrabold tabular-nums text-amber-800">
                        {r.lateReturnHours} ساعة
                      </td>
                      <td className="py-3">
                        {isWaived ? (
                          <span className="inline-block rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-black text-gray-600 ring-1 ring-gray-200">
                            مُعفاة
                          </span>
                        ) : isApplied ? (
                          <span className="font-extrabold tabular-nums text-red-700" dir="ltr">
                            {formatSar(penaltyExcl)} ر.س
                            <span className="mr-1 text-[10px] font-bold text-on-surface-variant">
                              قبل الضريبة
                            </span>
                          </span>
                        ) : (
                          <span className="inline-block rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700 ring-1 ring-emerald-200">
                            مغطاة مسبقاً
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-xs font-bold text-on-surface-variant">
                        {r.lateReturnDecidedBy ?? "—"}
                      </td>
                      <td className="py-3">
                        {!isApplied ? (
                          <span className="text-xs font-bold text-on-surface-variant">—</span>
                        ) : stillDue ? (
                          <div className="flex flex-col gap-1.5">
                            <span className="inline-block w-fit rounded-full bg-amber-50 px-2.5 py-1 text-[11px] font-black text-amber-800 ring-1 ring-amber-200">
                              بانتظار التحصيل — {formatSar(r.balanceDueAtBranchSar ?? 0)} ر.س
                            </span>
                            <Link
                              href={`/admin/bookings/${r.id}/finance`}
                              className="w-fit rounded-lg bg-[#003749] px-3 py-1.5 text-xs font-extrabold text-white hover:opacity-95"
                            >
                              تسجيل تحصيل
                            </Link>
                          </div>
                        ) : (
                          <span className="inline-block rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-black text-emerald-700 ring-1 ring-emerald-200">
                            تم التحصيل
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </div>
  );
}
