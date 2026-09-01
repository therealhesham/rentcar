"use client";

import { useActionState, useMemo, useState } from "react";
import { updatePromoBadgeAction } from "@/app/admin/promo-badge-actions";
import type { PromoBadgeSettings } from "@/lib/promo-badge";

export type PromoBadgeModelOption = {
  id: number;
  label: string;
  priceLabel: string;
  createdAtIso: string;
  updatedAtIso: string;
};

type Props = {
  settings: PromoBadgeSettings;
  models: PromoBadgeModelOption[];
};

type SortKey = "updatedDesc" | "createdDesc" | "name";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "updatedDesc", label: "الأحدث تعديلاً" },
  { value: "createdDesc", label: "الأحدث إضافةً" },
  { value: "name", label: "الاسم" },
];

const INPUT_CLASS =
  "w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-2.5 text-sm font-medium text-on-surface outline-none ring-primary/50 transition-all focus:border-primary focus:ring-2";

function formatDateAr(iso: string): string {
  return new Date(iso).toLocaleDateString("ar-SA", {
    timeZone: "Asia/Riyadh",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function PromoBadgeForm({ settings, models }: Props) {
  const [state, formAction, pending] = useActionState(updatePromoBadgeAction, null);

  const [isActive, setIsActive] = useState(settings.isActive);
  const [labelAr, setLabelAr] = useState(settings.labelAr);
  const [backgroundColor, setBackgroundColor] = useState(settings.backgroundColor);
  const [textColor, setTextColor] = useState(settings.textColor);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set(settings.carModelIds));
  const [search, setSearch] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("updatedDesc");

  const visibleModels = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q ? models.filter((m) => m.label.toLowerCase().includes(q)) : models;
    const sorted = [...filtered];
    if (sortKey === "updatedDesc") {
      sorted.sort((a, b) => b.updatedAtIso.localeCompare(a.updatedAtIso));
    } else if (sortKey === "createdDesc") {
      sorted.sort((a, b) => b.createdAtIso.localeCompare(a.createdAtIso));
    } else {
      sorted.sort((a, b) => a.label.localeCompare(b.label, "ar"));
    }
    return sorted;
  }, [models, search, sortKey]);

  function toggleModel(id: number) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      visibleModels.forEach((m) => next.add(m.id));
      return next;
    });
  }

  function clearAllVisible() {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      visibleModels.forEach((m) => next.delete(m.id));
      return next;
    });
  }

  return (
    <form
      action={formAction}
      className="max-w-3xl space-y-8 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6"
    >
      <fieldset className="space-y-3">
        <label className="flex cursor-pointer items-center gap-3">
          <input
            type="checkbox"
            name="isActive"
            checked={isActive}
            onChange={(e) => setIsActive(e.target.checked)}
            className="size-4 accent-primary"
          />
          <span className="text-base font-extrabold text-on-surface">تفعيل الشارة</span>
        </label>
        <p className="text-xs text-on-surface-variant">
          معطَّلة = كل الموديلات ترجع لشارة «وفّرت/خصم» المعتادة تلقائياً بدون أي تعديل إضافي.
        </p>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block text-sm font-bold text-on-surface">
          نص الشارة (عربي)
          <input
            type="text"
            name="labelAr"
            value={labelAr}
            onChange={(e) => setLabelAr(e.target.value)}
            maxLength={40}
            placeholder="مثال: عرض اليوم الوطني"
            className={`${INPUT_CLASS} mt-1.5`}
            dir="rtl"
          />
        </label>
        <label className="block text-sm font-bold text-on-surface">
          نص الشارة (إنجليزي، اختياري)
          <input
            type="text"
            name="labelEn"
            defaultValue={settings.labelEn}
            maxLength={40}
            placeholder="e.g. National Day Offer"
            className={`${INPUT_CLASS} mt-1.5`}
            dir="ltr"
          />
        </label>
        <label className="block text-sm font-bold text-on-surface">
          لون الخلفية
          <div className="mt-1.5 flex items-center gap-2">
            <input
              type="color"
              value={backgroundColor}
              onChange={(e) => setBackgroundColor(e.target.value)}
              className="h-10 w-14 shrink-0 cursor-pointer rounded-lg border border-outline-variant/40 bg-transparent p-1"
            />
            <input
              type="text"
              name="backgroundColor"
              value={backgroundColor}
              onChange={(e) => setBackgroundColor(e.target.value)}
              className={`${INPUT_CLASS} font-mono uppercase`}
              dir="ltr"
            />
          </div>
        </label>
        <label className="block text-sm font-bold text-on-surface">
          لون النص
          <div className="mt-1.5 flex items-center gap-2">
            <input
              type="color"
              value={textColor}
              onChange={(e) => setTextColor(e.target.value)}
              className="h-10 w-14 shrink-0 cursor-pointer rounded-lg border border-outline-variant/40 bg-transparent p-1"
            />
            <input
              type="text"
              name="textColor"
              value={textColor}
              onChange={(e) => setTextColor(e.target.value)}
              className={`${INPUT_CLASS} font-mono uppercase`}
              dir="ltr"
            />
          </div>
        </label>
      </div>

      <div>
        <p className="mb-2 text-sm font-bold text-on-surface">معاينة</p>
        <span
          className="inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-bold"
          style={{ backgroundColor, color: textColor }}
        >
          {labelAr || "—"}
        </span>
      </div>

      <fieldset className="space-y-3">
        <legend className="text-base font-extrabold text-on-surface">
          الموديلات المختارة ({selectedIds.size})
        </legend>

        <div className="flex flex-wrap items-center gap-2">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث بالبراند أو الاسم..."
            className={`${INPUT_CLASS} max-w-xs`}
            dir="rtl"
          />
          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className={`${INPUT_CLASS} w-auto`}
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                ترتيب: {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={selectAllVisible}
            className="rounded-lg border border-outline-variant/40 px-3 py-1.5 text-xs font-bold text-on-surface hover:bg-surface-container"
          >
            تحديد الظاهر كله
          </button>
          <button
            type="button"
            onClick={clearAllVisible}
            className="rounded-lg border border-outline-variant/40 px-3 py-1.5 text-xs font-bold text-on-surface hover:bg-surface-container"
          >
            إلغاء تحديد الظاهر
          </button>
        </div>

        <ul className="max-h-96 space-y-1.5 overflow-y-auto rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-2">
          {visibleModels.length === 0 ? (
            <li className="px-3 py-6 text-center text-xs text-on-surface-variant">لا توجد نتائج.</li>
          ) : (
            visibleModels.map((m) => (
              <li key={m.id}>
                <label className="flex cursor-pointer items-center justify-between gap-3 rounded-lg px-3 py-2 hover:bg-surface-container">
                  <span className="flex items-center gap-2.5 min-w-0">
                    <input
                      type="checkbox"
                      name="carModelIds"
                      value={m.id}
                      checked={selectedIds.has(m.id)}
                      onChange={() => toggleModel(m.id)}
                      className="size-4 shrink-0 accent-primary"
                    />
                    <span className="truncate text-sm font-semibold text-on-surface">{m.label}</span>
                    <span className="shrink-0 text-xs text-on-surface-variant">{m.priceLabel}</span>
                  </span>
                  <span className="shrink-0 text-[11px] text-on-surface-variant">
                    {sortKey === "createdDesc"
                      ? `أُضيف: ${formatDateAr(m.createdAtIso)}`
                      : `آخر تحديث: ${formatDateAr(m.updatedAtIso)}`}
                  </span>
                </label>
              </li>
            ))
          )}
        </ul>
      </fieldset>

      {state?.error ? (
        <p className="rounded-lg bg-error-container/30 px-3 py-2 text-sm font-bold text-error">{state.error}</p>
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
