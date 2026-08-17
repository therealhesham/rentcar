import Link from "next/link";
import { INSIGHTS_RANGES, type InsightsRange } from "@/lib/insights/insights-types";

/** روابط عادية لا حالة عميل: الفترة في الـ URL فتبقى قابلة للمشاركة والحفظ. */
export function InsightsRangeTabs({ days }: { days: InsightsRange }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {INSIGHTS_RANGES.map((d) => (
        <Link
          key={d}
          href={`/admin/insights?days=${d}`}
          aria-current={d === days ? "page" : undefined}
          className={
            d === days
              ? "rounded-xl bg-primary px-4 py-2 text-sm font-bold text-white shadow-sm"
              : "rounded-xl bg-surface-container-low px-4 py-2 text-sm font-bold text-on-surface-variant transition-colors hover:bg-surface-container-high"
          }
        >
          آخر {d} يوماً
        </Link>
      ))}
    </div>
  );
}
