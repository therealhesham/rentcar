"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { updateRentalAddon } from "@/app/admin/rental-addon-actions";
import type { RentalAddonAdminRow } from "@/lib/rental-addon-admin-data";
import { SarCurrencyGlyph } from "@/components/ui/SarCurrencyGlyph";

const iconOptions: { value: string; label: string }[] = [
  { value: "", label: "افتراضي (عام)" },
  { value: "key", label: "مفتاح — أمان المفتاح" },
  { value: "key-plus", label: "درع — أمان المفتاح بلس" },
  { value: "child", label: "طفل — مقعد طفل" },
  { value: "gauge", label: "عداد — كيلومتر مفتوح" },
];

export function RentalAddonEditForm({ addon }: { addon: RentalAddonAdminRow }) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(updateRentalAddon, null);

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
    }
  }, [state?.ok, router]);

  const iconValue = addon.iconKey ?? "";

  return (
    <form
      action={formAction}
      className="grid gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 md:grid-cols-2"
    >
      <input type="hidden" name="id" value={addon.id} />

      <h2 className="md:col-span-2 text-lg font-extrabold tracking-tight">بيانات الإضافة</h2>

      <label className="text-sm font-medium md:col-span-1">
        العنوان (عربي)
        <input
          name="titleAr"
          required
          defaultValue={addon.titleAr}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>
      <label className="text-sm font-medium md:col-span-1">
        المعرّف (slug)
        <input
          name="slug"
          required
          defaultValue={addon.slug}
          dir="ltr"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 font-mono text-sm text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <label className="text-sm font-medium md:col-span-2">
        الوصف (عربي، اختياري)
        <textarea
          name="descriptionAr"
          rows={3}
          defaultValue={addon.descriptionAr ?? ""}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <label className="text-sm font-medium md:col-span-2">
        نص المعلومات (زر i) — اختياري
        <textarea
          name="infoAr"
          rows={4}
          defaultValue={addon.infoAr ?? ""}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <label className="text-sm font-medium md:col-span-1">
        السعر لكل يوم (<SarCurrencyGlyph />، غير شامل الضريبة)
        <input
          name="pricePerDay"
          type="number"
          min={0}
          step={1}
          required
          defaultValue={addon.pricePerDay}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 tabular-nums text-on-surface outline-none ring-primary/30 focus:ring-2"
          dir="ltr"
        />
      </label>
      <label className="text-sm font-medium md:col-span-1">
        ترتيب العرض
        <input
          name="sortOrder"
          type="number"
          step={1}
          defaultValue={addon.sortOrder}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 tabular-nums text-on-surface outline-none ring-primary/30 focus:ring-2"
          dir="ltr"
        />
      </label>

      <label className="text-sm font-medium md:col-span-1">
        مجموعة التعارض (إما/أو)
        <input
          name="exclusiveGroup"
          type="text"
          defaultValue={addon.exclusiveGroup ?? ""}
          placeholder="مثال: key-protection"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
          dir="ltr"
        />
        <span className="mt-1 block text-xs font-normal text-on-surface-variant">
          إضافات بنفس المعرّف لا تُختار معاً. اتركه فارغاً إن لم يكن هناك تعارض.
        </span>
      </label>

      <label className="text-sm font-medium md:col-span-1">
        أيقونة الواجهة
        <select
          name="iconKey"
          defaultValue={iconValue}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        >
          {addon.iconKey &&
          !iconOptions.some((o) => o.value === addon.iconKey) ? (
            <option value={addon.iconKey}>
              {addon.iconKey} (قيمة مخزّنة — اختر معروفاً أو احتفظ بها)
            </option>
          ) : null}
          {iconOptions.map((o) => (
            <option key={o.value || "none"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex cursor-pointer items-center gap-2 text-sm font-bold md:col-span-1 md:self-end">
        <input
          type="checkbox"
          name="isActive"
          defaultChecked={addon.isActive}
          className="size-4 accent-primary"
        />
        مفعّلة للعرض في صفحة الحجز
      </label>

      <div className="md:col-span-2 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "جاري الحفظ…" : "حفظ التعديلات"}
        </button>
        {state?.ok ? (
          <span className="text-sm font-bold text-primary" role="status">
            تم الحفظ.
          </span>
        ) : null}
        {state?.error ? (
          <span className="text-sm font-bold text-error" role="alert">
            {state.error}
          </span>
        ) : null}
      </div>
    </form>
  );
}
