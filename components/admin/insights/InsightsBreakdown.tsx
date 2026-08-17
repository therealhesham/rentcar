import type { BreakdownRow } from "@/lib/insights/insights-types";
import {
  InsightsBar,
  InsightsEmpty,
  formatPercent,
} from "@/components/admin/insights/InsightsShell";

export function InsightsBreakdown({
  title,
  rows,
}: {
  title: string;
  rows: BreakdownRow[];
}) {
  return (
    <div>
      <p className="mb-3 text-sm font-bold text-on-surface">{title}</p>
      {rows.length === 0 ? (
        <InsightsEmpty>لا توجد بيانات.</InsightsEmpty>
      ) : (
        <ul className="space-y-3">
          {rows.map((row) => (
            <li key={row.label}>
              <div className="mb-1 flex items-baseline justify-between gap-2">
                <span className="truncate text-sm font-medium text-on-surface">{row.label}</span>
                <span className="shrink-0 text-xs font-bold tabular-nums text-on-surface-variant">
                  {formatPercent(row.share)} · {row.count.toLocaleString("ar-EG")}
                </span>
              </div>
              <InsightsBar share={row.share} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
