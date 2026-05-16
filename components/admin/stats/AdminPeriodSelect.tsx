"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import type { AdminStatsPeriod } from "@/lib/admin-statistics";

const OPTIONS: { days: AdminStatsPeriod; label: string }[] = [
  { days: 7, label: "7 أيام" },
  { days: 30, label: "30 يوماً" },
  { days: 90, label: "90 يوماً" },
  { days: 365, label: "سنة" },
];

export function AdminPeriodSelect({ current }: { current: AdminStatsPeriod }) {
  const pathname = usePathname();
  const sp = useSearchParams();

  return (
    <div
      className="inline-flex flex-wrap gap-1 rounded-xl border border-outline-variant/25 bg-white p-1 shadow-sm"
      role="tablist"
      aria-label="الفترة الزمنية"
    >
      {OPTIONS.map((opt) => {
        const active = current === opt.days;
        const qs = new URLSearchParams(sp?.toString() ?? "");
        qs.set("days", String(opt.days));
        return (
          <Link
            key={opt.days}
            href={`${pathname}?${qs.toString()}`}
            role="tab"
            aria-selected={active}
            className={`rounded-lg px-3.5 py-2 text-xs font-bold transition-colors ${
              active
                ? "bg-[#003749] text-white shadow-sm"
                : "text-on-surface-variant hover:bg-surface-container-low hover:text-on-surface"
            }`}
          >
            {opt.label}
          </Link>
        );
      })}
    </div>
  );
}
