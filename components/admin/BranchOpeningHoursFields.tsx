"use client";

import { useMemo, useState } from "react";
import type { BranchDayHoursRow } from "@/lib/branch-opening-hours";

const DAY_KEYS = ["0", "1", "2", "3", "4", "5", "6"] as const;
const DAY_LABELS: Record<(typeof DAY_KEYS)[number], string> = {
  "0": "الأحد",
  "1": "الإثنين",
  "2": "الثلاثاء",
  "3": "الأربعاء",
  "4": "الخميس",
  "5": "الجمعة",
  "6": "السبت",
};

export type BranchOpeningHoursEditorState = Record<
  string,
  { closed: boolean; open: string; close: string }
>;

function defaultOpenState(): BranchOpeningHoursEditorState {
  const o: BranchOpeningHoursEditorState = {};
  for (const k of DAY_KEYS) {
    o[k] = { closed: false, open: "09:00", close: "22:00" };
  }
  return o;
}

function stateFromParsed(raw: string | null | undefined): {
  useHours: boolean;
  state: BranchOpeningHoursEditorState;
} {
  if (!raw?.trim()) {
    return { useHours: false, state: defaultOpenState() };
  }
  try {
    const o = JSON.parse(raw) as { days?: Record<string, BranchDayHoursRow> };
    const days = o?.days;
    if (!days || typeof days !== "object") {
      return { useHours: false, state: defaultOpenState() };
    }
    const state = defaultOpenState();
    for (const k of DAY_KEYS) {
      const row = days[k];
      if (!row) continue;
      if (row.closed === true) {
        state[k] = { closed: true, open: "09:00", close: "22:00" };
      } else {
        state[k] = {
          closed: false,
          open: typeof row.open === "string" && row.open ? row.open : "09:00",
          close: typeof row.close === "string" && row.close ? row.close : "22:00",
        };
      }
    }
    return { useHours: true, state };
  } catch {
    return { useHours: false, state: defaultOpenState() };
  }
}

function serializeState(s: BranchOpeningHoursEditorState): string {
  const days: Record<string, BranchDayHoursRow> = {};
  for (const k of DAY_KEYS) {
    const row = s[k];
    if (row.closed) {
      days[k] = { closed: true };
    } else {
      days[k] = { open: row.open.trim() || "09:00", close: row.close.trim() || "22:00" };
    }
  }
  return JSON.stringify({ days });
}

type Props = {
  initialOpeningHoursJson: string | null | undefined;
};

/**
 * حقول مواعيد العمل + إخفاء JSON للنموذج.
 */
export function BranchOpeningHoursFields({ initialOpeningHoursJson }: Props) {
  const initial = useMemo(
    () => stateFromParsed(initialOpeningHoursJson),
    [initialOpeningHoursJson],
  );
  const [useHours, setUseHours] = useState(initial.useHours);
  const [dayState, setDayState] = useState<BranchOpeningHoursEditorState>(initial.state);

  const json = useMemo(() => serializeState(dayState), [dayState]);

  function updateDay(
    key: (typeof DAY_KEYS)[number],
    patch: Partial<{ closed: boolean; open: string; close: string }>,
  ) {
    setDayState((prev) => ({
      ...prev,
      [key]: { ...prev[key], ...patch },
    }));
  }

  return (
    <div className="md:col-span-2 space-y-4 rounded-2xl border border-outline-variant/40 bg-surface-container-lowest/60 p-5">
      <label className="flex cursor-pointer items-center gap-3 text-sm font-bold text-on-surface">
        <input
          type="checkbox"
          checked={useHours}
          onChange={(e) => setUseHours(e.target.checked)}
          className="size-4 rounded border-outline-variant text-primary focus:ring-primary/40"
        />
        تقييد الحجز بمواعيد عمل هذا الفرع (توقيت السعودية)
      </label>
      <p className="text-xs font-medium leading-relaxed text-on-surface-variant">
        عند التفعيل، لن يُقبل استلام السيارة من الفرع خارج الأوقات المحددة. اترك الخيار بدون تفعيل
        ليعمل الفرع على مدار الساعة في نماذج الحجز.
      </p>

      {useHours ? (
        <div className="space-y-3">
          {DAY_KEYS.map((k) => (
            <div
              key={k}
              className="flex flex-col gap-3 rounded-xl border border-outline-variant/30 bg-surface-container-low p-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4"
            >
              <span className="min-w-[5.5rem] text-sm font-bold text-on-surface">{DAY_LABELS[k]}</span>
              <label className="flex items-center gap-2 text-sm font-medium text-on-surface">
                <input
                  type="checkbox"
                  checked={dayState[k].closed}
                  onChange={(e) => updateDay(k, { closed: e.target.checked })}
                  className="size-4 rounded border-outline-variant"
                />
                مغلق
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-xs text-on-surface-variant">من</span>
                <input
                  type="time"
                  disabled={dayState[k].closed}
                  value={dayState[k].open}
                  onChange={(e) => updateDay(k, { open: e.target.value })}
                  className="rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm disabled:opacity-50"
                  dir="ltr"
                />
                <span className="text-xs text-on-surface-variant">إلى</span>
                <input
                  type="time"
                  disabled={dayState[k].closed}
                  value={dayState[k].close}
                  onChange={(e) => updateDay(k, { close: e.target.value })}
                  className="rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm disabled:opacity-50"
                  dir="ltr"
                />
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <input type="hidden" name="openingHoursJson" value={useHours ? json : ""} />
    </div>
  );
}
