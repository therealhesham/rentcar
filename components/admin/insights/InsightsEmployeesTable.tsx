import { formatRiyadhDateTime, relativeFromNow } from "@/lib/insights/insights-time";
import type { EmployeeUsageRow } from "@/lib/insights/insights-types";
import { InsightsEmpty } from "@/components/admin/insights/InsightsShell";

export function InsightsEmployeesTable({ rows }: { rows: EmployeeUsageRow[] }) {
  if (rows.length === 0) {
    return (
      <InsightsEmpty>
        لا توجد فتحات مسجّلة بعد. القياس يبدأ من أول مرة يفتح فيها موظف صفحة بعد تفعيل هذه
        الصفحة — لا توجد بيانات تاريخية لأنها لم تكن تُسجَّل.
      </InsightsEmpty>
    );
  }

  const max = rows[0]!.views;

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[720px] text-sm">
        <thead>
          <tr className="border-b border-outline-variant/25 text-xs text-on-surface-variant">
            <th className="py-2 text-start font-bold">#</th>
            <th className="py-2 text-start font-bold">الموظف</th>
            <th className="py-2 text-start font-bold">فتحات الصفحات</th>
            <th className="py-2 text-start font-bold">جلسات</th>
            <th className="py-2 text-start font-bold">أيام نشطة</th>
            <th className="py-2 text-start font-bold">أكثر صفحة يفتحها</th>
            <th className="py-2 text-start font-bold">الجهاز</th>
            <th className="py-2 text-start font-bold">آخر ظهور</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={`${row.employeeId ?? "x"}-${row.label}-${i}`}
              className="border-b border-outline-variant/10 last:border-0"
            >
              <td className="py-3 pe-3 text-xs font-bold tabular-nums text-on-surface-variant">
                {i + 1}
              </td>
              <td className="py-3 pe-3">
                <p className="font-bold text-on-surface">{row.label}</p>
                {row.isSuperAdmin ? (
                  <span className="mt-0.5 inline-block rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                    مدير النظام
                  </span>
                ) : null}
              </td>
              <td className="w-36 py-3 pe-3">
                <span className="font-extrabold tabular-nums text-on-surface">
                  {row.views.toLocaleString("ar-EG")}
                </span>
                <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-surface-container-high">
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: `${Math.max((row.views / max) * 100, 2)}%` }}
                  />
                </div>
              </td>
              <td className="py-3 pe-3 tabular-nums text-on-surface-variant">
                {row.sessions.toLocaleString("ar-EG")}
              </td>
              <td className="py-3 pe-3 tabular-nums text-on-surface-variant">
                {row.activeDays.toLocaleString("ar-EG")}
              </td>
              <td className="max-w-[200px] py-3 pe-3">
                <p className="truncate text-on-surface">{row.topPageLabel}</p>
                <p className="text-xs text-on-surface-variant">
                  {row.topPageViews.toLocaleString("ar-EG")} فتحة · {row.distinctPages} صفحة مختلفة
                </p>
              </td>
              <td className="max-w-[180px] py-3 pe-3 text-xs text-on-surface-variant">
                {row.devices[0] ?? "—"}
                {row.devices.length > 1 ? (
                  <span className="block text-[10px]">+{row.devices.length - 1} جهاز آخر</span>
                ) : null}
              </td>
              <td
                className="whitespace-nowrap py-3 text-xs text-on-surface-variant"
                title={formatRiyadhDateTime(row.lastSeenAt)}
              >
                {relativeFromNow(row.lastSeenAt)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
