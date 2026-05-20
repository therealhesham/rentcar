import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { ConfirmInterBranchReturnForm } from "@/components/admin/branch-returns/ConfirmInterBranchReturnForm";
import type { BranchReturnRow } from "@/lib/admin-branch-returns";
import { formatReturnTimeAr } from "@/lib/booking-return-schedule";

type Props = {
  returns: BranchReturnRow[];
  showReturnBranchColumn: boolean;
};

export function BranchReturnsTable({ returns, showReturnBranchColumn }: Props) {
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
              <table className="w-full min-w-[1100px] text-start text-sm">
                <thead>
                  <tr className="border-b border-outline-variant/30 text-on-surface-variant">
                    <th className="px-3 py-2">الوقت</th>
                    <th className="px-3 py-2">السيارة</th>
                    <th className="px-3 py-2">العميل</th>
                    <th className="px-3 py-2">الجوال</th>
                    <th className="px-3 py-2">فرع الاستلام</th>
                    {showReturnBranchColumn ? (
                      <th className="px-3 py-2">فرع الإرجاع</th>
                    ) : null}
                    <th className="px-3 py-2">تحويل المخزون</th>
                    <th className="px-3 py-2">أيام</th>
                    <th className="px-3 py-2">الحالة</th>
                    <th className="px-3 py-2">#</th>
                  </tr>
                </thead>
                <tbody>
                  {hourRows.map((b) => (
                    <tr
                      key={b.id}
                      className={[
                        "border-b border-outline-variant/15",
                        b.isInterBranchPickup && !b.interBranchReturnConfirmedAt
                          ? "bg-amber-50/40"
                          : "",
                      ].join(" ")}
                    >
                      <td className="px-3 py-2 font-mono tabular-nums" dir="ltr">
                        {formatReturnTimeAr(b.returnAt)}
                      </td>
                      <td className="px-3 py-2 font-medium">{b.carLabel}</td>
                      <td className="px-3 py-2">
                        <span className="font-medium">{b.fullName}</span>
                        {b.contactEmail ? (
                          <span className="mt-0.5 block text-xs text-on-surface-variant" dir="ltr">
                            {b.contactEmail}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 font-mono tabular-nums" dir="ltr">
                        {b.phone}
                      </td>
                      <td className="px-3 py-2">
                        {b.isInterBranchPickup ? (
                          <span className="font-bold text-[#003749]">
                            {b.pickupBranchName}
                          </span>
                        ) : (
                          <span className="text-on-surface-variant">
                            {b.pickupMode === "DELIVERY" ? b.pickupSummary : "نفس فرع الإرجاع"}
                          </span>
                        )}
                      </td>
                      {showReturnBranchColumn ? (
                        <td className="px-3 py-2 font-medium">{b.returnBranchName}</td>
                      ) : null}
                      <td className="px-3 py-2 align-top">
                        {b.isInterBranchPickup ? (
                          b.interBranchReturnConfirmedAt ? (
                            <span className="text-xs font-bold text-primary">
                              تم (+1 هنا / −1{" "}
                              {b.pickupBranchName})
                            </span>
                          ) : (
                            <ConfirmInterBranchReturnForm bookingRequestId={b.id} />
                          )
                        ) : (
                          <span className="text-xs text-on-surface-variant">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{b.numberOfDays}</td>
                      <td className="px-3 py-2">
                        <AdminStatusBadge status={b.status} />
                      </td>
                      <td className="px-3 py-2 tabular-nums text-on-surface-variant">
                        {b.id}
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
