import type { ReactNode } from "react";

/**
 * عناصر عرض مشتركة لصفحة «إحصائيات». نسخة مستقلة عن `AdminCard`/`AdminStatCard`
 * عن قصد — الصفحة كلها ملفات جديدة، وتغيير تنسيقها لا يجب أن يمسّ بقية اللوحة.
 */

export function InsightsSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-outline-variant/25 bg-white shadow-[0_4px_24px_-10px_rgba(28,27,27,0.1)]">
      <div className="rounded-t-2xl border-b border-outline-variant/15 bg-surface-container-low/40 px-5 py-4 sm:px-6">
        <h2 className="text-lg font-extrabold tracking-tight text-on-surface">{title}</h2>
        {description ? (
          <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">{description}</p>
        ) : null}
      </div>
      <div className="p-5 sm:p-6">{children}</div>
    </section>
  );
}

export function InsightsStat({
  label,
  value,
  hint,
}: {
  label: string;
  value: string | number;
  hint?: string;
}) {
  return (
    <div className="rounded-2xl border border-outline-variant/25 bg-white p-4 shadow-[0_4px_24px_-10px_rgba(28,27,27,0.1)]">
      <p className="text-xs font-bold text-on-surface-variant">{label}</p>
      <p className="mt-1 text-2xl font-extrabold tracking-tight text-on-surface">{value}</p>
      {hint ? <p className="mt-1 text-xs text-on-surface-variant">{hint}</p> : null}
    </div>
  );
}

export function InsightsEmpty({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-outline-variant/40 bg-surface-container-low/40 px-4 py-8 text-center text-sm text-on-surface-variant">
      {children}
    </p>
  );
}

/** شريط نسبة أفقي — يعمل في RTL بلا تعديل لأن الحاوية `flex` بلا اتجاه صريح. */
export function InsightsBar({ share }: { share: number }) {
  return (
    <div className="h-2 w-full overflow-hidden rounded-full bg-surface-container-high">
      <div
        className="h-full rounded-full bg-primary"
        style={{ width: `${Math.max(share * 100, 1.5)}%` }}
      />
    </div>
  );
}

export function formatPercent(share: number): string {
  return `${(share * 100).toFixed(share < 0.1 ? 1 : 0)}%`;
}
