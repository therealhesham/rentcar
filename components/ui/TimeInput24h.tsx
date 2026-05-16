"use client";

import { useMemo } from "react";

const HOURS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTES = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, "0"));

function parseHm(value: string): { hh: string; mm: string } {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value.trim());
  if (!m) return { hh: "09", mm: "00" };
  const h = Math.min(23, Math.max(0, Number(m[1])));
  const mi = Math.min(59, Math.max(0, Number(m[2])));
  return { hh: String(h).padStart(2, "0"), mm: String(mi).padStart(2, "0") };
}

export function TimeInput24h({
  id,
  value,
  onChange,
  disabled,
  readOnly,
  "aria-label": ariaLabel,
  className,
}: {
  id?: string;
  value: string;
  onChange: (hm: string) => void;
  disabled?: boolean;
  readOnly?: boolean;
  "aria-label"?: string;
  className?: string;
}) {
  const { hh, mm } = useMemo(() => parseHm(value), [value]);
  const locked = Boolean(disabled || readOnly);

  return (
    <div
      id={id}
      role="group"
      aria-label={ariaLabel}
      dir="ltr"
      className={
        className ??
        "flex min-w-0 cursor-pointer items-center gap-0.5 rounded-md border border-[#ebe4d3]/80 bg-white/80 px-1 py-0.5 text-[13px] font-semibold tabular-nums text-[#0f1923] outline-none focus-within:ring-2 focus-within:ring-[#dbb878]/30"
      }
    >
      <select
        aria-label={ariaLabel ? `${ariaLabel} — الساعة` : "الساعة (24)"}
        disabled={locked}
        value={hh}
        onChange={(e) => onChange(`${e.target.value}:${mm}`)}
        className="min-w-0 flex-1 cursor-pointer bg-transparent py-1 pl-1 pr-0 text-[13px] font-semibold tabular-nums outline-none disabled:cursor-default"
      >
        {HOURS.map((h) => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="shrink-0 select-none text-[#0f1923]/70" aria-hidden>
        :
      </span>
      <select
        aria-label={ariaLabel ? `${ariaLabel} — الدقائق` : "الدقائق"}
        disabled={locked}
        value={mm}
        onChange={(e) => onChange(`${hh}:${e.target.value}`)}
        className="min-w-0 flex-1 cursor-pointer bg-transparent py-1 pl-0 pr-1 text-[13px] font-semibold tabular-nums outline-none disabled:cursor-default"
      >
        {MINUTES.map((m) => (
          <option key={m} value={m}>
            {m}
          </option>
        ))}
      </select>
    </div>
  );
}
