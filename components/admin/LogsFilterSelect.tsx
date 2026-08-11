"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

export type LogsFilterGroup = {
  label: string;
  options: string[];
};

type Props = {
  name: "q" | "exclude";
  value: string[];
  groups: LogsFilterGroup[];
  color: "emerald" | "rose";
  label: string;
};

export function LogsFilterSelect({ name, value, groups, color, label }: Props) {
  const [selected, setSelected] = useState<string[]>(value);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync with URL (browser back/forward)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { setSelected(value); }, [value.join(",")]);

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const navigate = useCallback(
    (newSelected: string[]) => {
      const params = new URLSearchParams(searchParams.toString());
      if (newSelected.length > 0) {
        params.set(name, newSelected.join(","));
      } else {
        params.delete(name);
      }
      params.delete("page");
      router.push(`/admin/logs?${params.toString()}#events`);
    },
    [searchParams, name, router],
  );

  const toggle = (opt: string) => {
    const newSelected = selected.includes(opt)
      ? selected.filter((s) => s !== opt)
      : [...selected, opt];
    setSelected(newSelected);
    navigate(newSelected);
    setSearch("");
  };

  const remove = (opt: string) => {
    const newSelected = selected.filter((s) => s !== opt);
    setSelected(newSelected);
    navigate(newSelected);
  };

  const filteredGroups = groups
    .map((g) => ({
      ...g,
      options: g.options.filter((o) =>
        search ? o.toLowerCase().includes(search.toLowerCase()) : true,
      ),
    }))
    .filter((g) => g.options.length > 0);

  const borderCls =
    color === "emerald"
      ? "border-emerald-500/40 focus-within:border-emerald-600 focus-within:ring-emerald-600/30"
      : "border-rose-500/40 focus-within:border-rose-600 focus-within:ring-rose-600/30";
  const labelCls = color === "emerald" ? "text-emerald-700" : "text-rose-700";
  const chipCls =
    color === "emerald"
      ? "bg-emerald-100 border-emerald-300 text-emerald-900"
      : "bg-rose-100 border-rose-300 text-rose-900";
  const chipXCls =
    color === "emerald"
      ? "text-emerald-500 hover:text-emerald-900"
      : "text-rose-500 hover:text-rose-900";
  const tickedCls =
    color === "emerald" ? "bg-emerald-600 border-emerald-600" : "bg-rose-600 border-rose-600";
  const activeRowCls =
    color === "emerald" ? "bg-emerald-50/60 font-bold" : "bg-rose-50/60 font-bold";

  return (
    <div ref={containerRef} className="relative flex-1 min-w-[220px]">
      {/* Chips box / trigger */}
      <div
        className={`flex min-h-[38px] flex-wrap items-center gap-1.5 rounded-xl border ${borderCls} bg-surface px-3 py-1.5 focus-within:ring-1 cursor-text`}
        onClick={() => { inputRef.current?.focus(); setOpen(true); }}
      >
        <span className={`text-xs font-bold ${labelCls} shrink-0`}>{label}</span>

        {selected.map((s) => (
          <span
            key={s}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${chipCls}`}
          >
            <span dir="ltr" className="max-w-[160px] truncate font-mono">{s}</span>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); remove(s); }}
              className={`shrink-0 font-black leading-none ${chipXCls}`}
              aria-label={`إزالة ${s}`}
            >×</button>
          </span>
        ))}

        <input
          ref={inputRef}
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          placeholder={selected.length === 0 ? "ابحث أو اختر..." : ""}
          className="min-w-[80px] flex-1 bg-transparent text-sm font-medium text-on-surface placeholder:text-on-surface-variant/40 focus:outline-none"
        />

        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`ms-auto size-3.5 shrink-0 text-on-surface-variant transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path d="m6 9 6 6 6-6" />
        </svg>
      </div>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-outline-variant/30 bg-surface shadow-2xl">
          {filteredGroups.length === 0 ? (
            <p className="px-4 py-3 text-sm text-on-surface-variant">لا توجد نتائج</p>
          ) : (
            filteredGroups.map((g) => (
              <div key={g.label}>
                <p className="sticky top-0 bg-surface-container px-3 py-1.5 text-[10px] font-extrabold uppercase tracking-widest text-on-surface-variant">
                  {g.label}
                </p>
                {g.options.map((opt) => {
                  const isSel = selected.includes(opt);
                  return (
                    <button
                      key={opt}
                      type="button"
                      onClick={() => toggle(opt)}
                      className={`flex w-full items-center gap-2.5 px-3 py-2 text-start text-sm transition-colors hover:bg-outline-variant/10 ${isSel ? activeRowCls : ""}`}
                    >
                      <span
                        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded border-2 transition-colors ${isSel ? tickedCls : "border-outline-variant/50 bg-surface"}`}
                      >
                        {isSel && (
                          <svg viewBox="0 0 10 10" fill="none" className="h-2.5 w-2.5">
                            <path d="M2 5l2.5 2.5L8 3" stroke="white" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        )}
                      </span>
                      <span dir="ltr" className="truncate font-mono text-xs">{opt}</span>
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
