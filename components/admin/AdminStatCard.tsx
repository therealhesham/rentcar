import Link from "next/link";
import type { ReactNode } from "react";

type Props = {
  label: string;
  value: ReactNode;
  href?: string;
  highlight?: boolean;
  hint?: string;
};

export function AdminStatCard({ label, value, href, highlight, hint }: Props) {
  const inner = (
    <>
      <p className="text-xs font-bold uppercase tracking-wide text-on-surface-variant">
        {label}
      </p>
      <p
        className={`mt-2 text-3xl font-extrabold tabular-nums tracking-tight ${
          highlight ? "text-[#9a3412]" : "text-on-surface"
        }`}
      >
        {value}
      </p>
      {hint ? <p className="mt-1.5 text-xs font-medium text-on-surface-variant">{hint}</p> : null}
    </>
  );

  const className = `block rounded-2xl border px-5 py-4 transition-all ${
    highlight
      ? "border-[#fdba74]/60 bg-[#fff7ed] shadow-[0_8px_24px_-12px_rgba(234,88,12,0.25)]"
      : "border-outline-variant/25 bg-white shadow-[0_4px_20px_-8px_rgba(28,27,27,0.08)] hover:border-primary/25 hover:shadow-[0_8px_28px_-10px_rgba(119,89,39,0.15)]"
  } ${href ? "cursor-pointer" : ""}`;

  if (href) {
    return (
      <Link href={href} className={className}>
        {inner}
      </Link>
    );
  }

  return <div className={className}>{inner}</div>;
}
