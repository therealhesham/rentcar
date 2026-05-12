"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createRentalAddon } from "@/app/admin/rental-addon-actions";
import { SarCurrencyGlyph } from "@/components/ui/SarCurrencyGlyph";

const iconOptions: { value: string; label: string }[] = [
  { value: "", label: "افتراضي (عام)" },
  { value: "key", label: "مفتاح — أمان المفتاح" },
  { value: "key-plus", label: "درع — أمان المفتاح بلس" },
  { value: "child", label: "طفل — مقعد طفل" },
  { value: "gauge", label: "عداد — كيلومتر مفتوح" },
];

export function RentalAddonCreateForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createRentalAddon, null);

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
    }
  }, [state?.ok, router]);

  return (
    <form
      action={formAction}
      className="mb-10 grid gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 md:grid-cols-2"
    >
      <h2 className="md:col-span-2 text-lg font-extrabold tracking-tight">إضافة إضافة تأجير</h2>

      <label className="text-sm font-medium md:col-span-1">
        العنوان (عربي)
        <input
          name="titleAr"
          required
          placeholder="مثال: مقعد طفل"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>
      <label className="text-sm font-medium md:col-span-1">
        المعرّف (slug) — إنجليزي
        <input
          name="slug"
          required
          placeholder="child-seat"
          dir="ltr"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 font-mono text-sm text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <label className="text-sm font-medium md:col-span-2">
        الوصف (عربي، اختياري)
        <textarea
          name="descriptionAr"
          rows={2}
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
          defaultValue={0}
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
          defaultValue={0}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 tabular-nums text-on-surface outline-none ring-primary/30 focus:ring-2"
          dir="ltr"
        />
      </label>

      <label className="text-sm font-medium md:col-span-1">
        أيقونة الواجهة
        <select
          name="iconKey"
          defaultValue=""
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        >
          {iconOptions.map((o) => (
            <option key={o.value || "none"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>

      <label className="flex cursor-pointer items-center gap-2 text-sm font-bold md:col-span-1 md:self-end">
        <input type="checkbox" name="isActive" defaultChecked className="size-4 accent-primary" />
        مفعّلة للعرض في صفحة الحجز
      </label>

      <div className="md:col-span-2 flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-on-primary transition-opacity hover:opacity-90 disabled:opacity-60"
        >
          {pending ? "جاري الحفظ…" : "حفظ الإضافة"}
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
