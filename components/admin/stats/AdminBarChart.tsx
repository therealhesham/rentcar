import type { DayCount } from "@/lib/admin-statistics";

type Props = {
  data: DayCount[];
  height?: number;
  accent?: string;
  emptyLabel?: string;
};

export function AdminBarChart({
  data,
  height = 160,
  accent = "#003749",
  emptyLabel = "لا توجد بيانات في هذه الفترة",
}: Props) {
  const max = Math.max(1, ...data.map((d) => d.count));
  const total = data.reduce((s, d) => s + d.count, 0);

  if (total === 0) {
    return (
      <p className="flex items-center justify-center rounded-xl bg-surface-container-low/50 py-12 text-sm font-medium text-on-surface-variant">
        {emptyLabel}
      </p>
    );
  }

  const showEvery = data.length > 14 ? Math.ceil(data.length / 7) : 1;

  return (
    <div
      className="flex items-end gap-1 sm:gap-1.5"
      style={{ height }}
      role="img"
      aria-label="مخطط أعمدة"
    >
      {data.map((d, i) => {
        const pct = (d.count / max) * 100;
        const showLabel = i % showEvery === 0 || i === data.length - 1;
        return (
          <div key={d.dateKey} className="flex min-w-0 flex-1 flex-col items-center gap-1">
            <span className="text-[10px] font-bold tabular-nums text-on-surface-variant">
              {d.count > 0 ? d.count : ""}
            </span>
            <div
              className="w-full min-h-[4px] rounded-t-md transition-all"
              style={{
                height: `${Math.max(4, (pct / 100) * (height - 36))}px`,
                background: `linear-gradient(180deg, ${accent} 0%, ${accent}99 100%)`,
              }}
              title={`${d.label}: ${d.count}`}
            />
            <span
              className={`max-w-full truncate text-[9px] font-semibold text-on-surface-variant/80 ${
                showLabel ? "" : "opacity-0"
              }`}
            >
              {d.label}
            </span>
          </div>
        );
      })}
    </div>
  );
}
