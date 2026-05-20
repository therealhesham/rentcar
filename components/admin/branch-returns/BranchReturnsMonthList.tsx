import Link from "next/link";
import { BranchReturnsTable } from "@/components/admin/branch-returns/BranchReturnsTable";
import type { BranchReturnRow } from "@/lib/admin-branch-returns";
import { formatReturnDateAr } from "@/lib/booking-return-schedule";

type Props = {
  returns: BranchReturnRow[];
  showReturnBranchColumn: boolean;
  branchQuery: string;
};

export function BranchReturnsMonthList({
  returns,
  showReturnBranchColumn,
  branchQuery,
}: Props) {
  const byDay = new Map<string, BranchReturnRow[]>();
  for (const row of returns) {
    const list = byDay.get(row.returnYmd) ?? [];
    list.push(row);
    byDay.set(row.returnYmd, list);
  }
  const dayKeys = [...byDay.keys()].sort();

  if (dayKeys.length === 0) {
    return (
      <p className="rounded-2xl border border-outline-variant/30 bg-surface-container-low px-5 py-6 text-sm text-on-surface-variant">
        لا توجد مرتجعات في هذا الشهر.
      </p>
    );
  }

  return (
    <div className="space-y-10">
      {dayKeys.map((ymd) => {
        const dayRows = byDay.get(ymd)!;
        const qs = new URLSearchParams();
        if (branchQuery) qs.set("branch", branchQuery);
        qs.set("view", "day");
        qs.set("date", ymd);
        qs.set("month", ymd.slice(0, 7));
        const dayHref = `/admin/branch-returns?${qs.toString()}`;
        return (
          <section key={ymd}>
            <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="text-lg font-extrabold tracking-tight text-primary">
                  {formatReturnDateAr(ymd)}
                </h2>
                <p className="mt-0.5 font-mono text-xs text-on-surface-variant" dir="ltr">
                  {ymd}
                </p>
              </div>
              <Link
                href={dayHref}
                className="rounded-full border border-primary/30 bg-primary-container/30 px-4 py-1.5 text-xs font-bold text-primary hover:bg-primary-container/50"
              >
                عرض اليوم ({dayRows.length})
              </Link>
            </div>
            <BranchReturnsTable
              returns={dayRows}
              showReturnBranchColumn={showReturnBranchColumn}
            />
          </section>
        );
      })}
    </div>
  );
}
