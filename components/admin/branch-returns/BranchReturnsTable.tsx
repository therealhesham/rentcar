import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import type { BranchReturnRow } from "@/lib/admin-branch-returns";
import { formatReturnTimeAr } from "@/lib/booking-return-schedule";

type Props = {
  returns: BranchReturnRow[];
  showBranchColumn: boolean;
  branchNames: Record<string, string>;
};

export function BranchReturnsTable({ returns, showBranchColumn, branchNames }: Props) {
  const byHour = new Map<string, BranchReturnRow[]>();
  for (const row of returns) {
    const hourKey = formatReturnTimeAr(row.returnAt);
    const list = byHour.get(hourKey) ?? [];
    list.push(row);
    byHour.set(hourKey, list);
  }
  const hourKeys = [...byHour.keys()];

  if (returns.length === 0) {
    return null;
  }

  return (
    <div className="space-y-8">
      {hourKeys.map((hour) => {
        const hourRows = byHour.get(hour)!;
        return (
          <section
            key={hour}
            className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5 md:p-6"
          >
            <h2 className="flex flex-wrap items-baseline gap-2 text-lg font-extrabold tracking-tight text-primary">
              <span>الساعة</span>
              <span dir="ltr" className="font-mono tabular-nums">
                {hour}
              </span>
              <span className="text-sm font-medium text-on-surface-variant">
                ({hourRows.length} {hourRows.length === 1 ? "مركبة" : "مركبات"})
              </span>
            </h2>
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[960px] text-start text-sm">
                <thead>
                  <tr className="border-b border-outline-variant/30 text-on-surface-variant">
                    <th className="px-3 py-2">الوقت</th>
                    <th className="px-3 py-2">السيارة</th>
                    <th className="px-3 py-2">العميل</th>
                    <th className="px-3 py-2">الجوال</th>
                    <th className="px-3 py-2">البريد</th>
                    <th className="px-3 py-2">الاستلام</th>
                    {showBranchColumn ? <th className="px-3 py-2">فرع الإرجاع</th> : null}
                    <th className="px-3 py-2">أيام الإيجار</th>
                    <th className="px-3 py-2">الحالة</th>
                    <th className="px-3 py-2">رقم الطلب</th>
                  </tr>
                </thead>
                <tbody>
                  {hourRows.map((b) => (
                    <tr key={b.id} className="border-b border-outline-variant/15">
                      <td className="px-3 py-2 font-mono tabular-nums" dir="ltr">
                        {formatReturnTimeAr(b.returnAt)}
                      </td>
                      <td className="px-3 py-2 font-medium">{b.carLabel}</td>
                      <td className="px-3 py-2">{b.fullName}</td>
                      <td className="px-3 py-2" dir="ltr">
                        {b.phone}
                      </td>
                      <td className="px-3 py-2 text-xs" dir="ltr">
                        {b.contactEmail ?? "—"}
                      </td>
                      <td className="max-w-[220px] px-3 py-2 text-xs leading-snug">
                        {b.pickupSummary}
                      </td>
                      {showBranchColumn ? (
                        <td className="px-3 py-2">
                          {branchNames[b.branchSlug] ?? b.branchSlug}
                        </td>
                      ) : null}
                      <td className="px-3 py-2 tabular-nums">{b.numberOfDays}</td>
                      <td className="px-3 py-2">
                        <AdminStatusBadge status={b.status} />
                      </td>
                      <td className="px-3 py-2 tabular-nums text-on-surface-variant">
                        #{b.id}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        );
      })}
    </div>
  );
}
