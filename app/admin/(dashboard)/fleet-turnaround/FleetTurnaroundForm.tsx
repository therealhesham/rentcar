"use client";

import { useActionState, useState } from "react";
import { updateFleetTurnaroundMinutes } from "@/app/admin/fleet-turnaround-actions";

type Props = {
  currentMinutes: number;
  defaultMinutes: number;
};

const PRESETS = [0, 60, 120, 240, 480];

/** «٩٠ دقيقة» → «ساعة و٣٠ دقيقة» لتقريب الرقم للموظف. */
function humanizeMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes <= 0) return "تسليم فوري بعد الإرجاع";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m} دقيقة`;
  const hourLabel = h === 1 ? "ساعة" : h === 2 ? "ساعتان" : `${h} ساعات`;
  return m === 0 ? hourLabel : `${hourLabel} و${m} دقيقة`;
}

export function FleetTurnaroundForm({ currentMinutes, defaultMinutes }: Props) {
  const [state, formAction, pending] = useActionState(updateFleetTurnaroundMinutes, null);
  const [minutes, setMinutes] = useState(String(currentMinutes));

  const parsed = Number(minutes);
  const preview = Number.isFinite(parsed) && parsed >= 0 ? humanizeMinutes(Math.round(parsed)) : "";

  return (
    <form
      action={formAction}
      className="max-w-2xl space-y-6 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6"
    >
      <div className="space-y-3">
        <label htmlFor="minutes" className="block text-base font-extrabold text-on-surface">
          فترة التجهيز بالدقائق
        </label>
        <input
          id="minutes"
          name="minutes"
          type="number"
          min={0}
          max={1440}
          step={15}
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-2.5 text-on-surface"
        />
        {preview ? (
          <p className="text-sm font-bold text-on-surface-variant">{preview}</p>
        ) : null}
        <p className="text-sm text-on-surface-variant">
          تُحجز هذه المدة بعد موعد إرجاع كل مركبة، فلا تظهر متاحة لعميل تالٍ قبل انقضائها.
          صفر يعني إتاحتها فور الإرجاع مباشرةً. الافتراضي {defaultMinutes} دقيقة، والحد الأقصى
          يوم كامل (١٤٤٠ دقيقة).
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            onClick={() => setMinutes(String(p))}
            className={`rounded-lg border px-3 py-1.5 text-sm font-bold transition-colors ${
              Number(minutes) === p
                ? "border-primary bg-primary-container/30 text-on-primary-container"
                : "border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant hover:border-outline-variant"
            }`}
          >
            {p === 0 ? "بدون" : humanizeMinutes(p)}
          </button>
        ))}
      </div>

      {state?.error ? (
        <p className="rounded-lg bg-error-container/30 px-3 py-2 text-sm font-bold text-error">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="rounded-lg bg-primary-container/30 px-3 py-2 text-sm font-bold text-on-primary-container">
          تم حفظ الإعداد.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-on-primary transition-opacity disabled:opacity-60"
      >
        {pending ? "جاري الحفظ…" : "حفظ"}
      </button>
    </form>
  );
}
