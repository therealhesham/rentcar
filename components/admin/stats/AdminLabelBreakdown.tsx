import type { LabelCount } from "@/lib/admin-statistics";

type Props = {
  items: LabelCount[];
  accent?: string;
  emptyLabel?: string;
  /** عرض العدد بجانب الشريطة */
  showCount?: boolean;
};

export function AdminLabelBreakdown({
  items,
  accent = "#775927",
  emptyLabel = "لا توجد بيانات",
  showCount = true,
}: Props) {
  if (items.length === 0) {
    return (
      <p className="py-6 text-center text-sm font-medium text-on-surface-variant">{emptyLabel}</p>
    );
  }

  return (
    <ul className="space-y-3.5" role="list">
      {items.map((item) => (
        <li key={item.label}>
          <div className="mb-1.5 flex items-center justify-between gap-2 text-sm">
            <span className="min-w-0 truncate font-bold text-on-surface">{item.label}</span>
            <span className="shrink-0 tabular-nums text-xs font-bold text-on-surface-variant">
              {showCount ? (
                <>
                  {item.count}
                  <span className="mx-1 text-outline-variant/60">·</span>
                </>
              ) : null}
              {item.pct}%
            </span>
          </div>
          <div className="h-2.5 overflow-hidden rounded-full bg-surface-container-high/80">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${Math.max(item.pct, 2)}%`,
                background: `linear-gradient(90deg, ${accent}, ${accent}cc)`,
              }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
