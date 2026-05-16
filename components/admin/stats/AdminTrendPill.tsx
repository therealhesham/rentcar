type Props = {
  deltaPct: number | null;
  label?: string;
};

export function AdminTrendPill({ deltaPct, label = "مقارنة بالفترة السابقة" }: Props) {
  if (deltaPct === null) {
    return (
      <span className="inline-flex items-center rounded-full bg-surface-container-high px-2.5 py-1 text-xs font-bold text-on-surface-variant">
        {label}: —
      </span>
    );
  }

  const up = deltaPct >= 0;
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold ${
        up ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
      }`}
    >
      <span aria-hidden>{up ? "↑" : "↓"}</span>
      {Math.abs(deltaPct)}%
      <span className="font-medium opacity-80">{label}</span>
    </span>
  );
}
