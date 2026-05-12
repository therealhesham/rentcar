"use client";

import { useActionState } from "react";
import { createInterCityShippingFee, type ActionState } from "@/app/admin/inter-city-shipping-actions";

export function InterCityShippingCreateForm({
  cities,
}: {
  cities: { id: number; slug: string; name: string }[];
}) {
  const [state, formAction, pending] = useActionState(createInterCityShippingFee, null as ActionState);

  return (
    <form
      action={formAction}
      className="mb-10 grid gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 md:grid-cols-2"
    >
      <h2 className="text-lg font-extrabold tracking-tight md:col-span-2">إضافة مسار شحن بين مدينتين</h2>
      <p className="text-sm text-on-surface-variant md:col-span-2">
        المبلغ بالريال <strong>غير شامل ضريبة القيمة المضافة</strong>؛ تُحسب الضريبة على المجموع في صفحة إتمام الحجز
        والدفع. اتجاه المسار مهم: من مدينة الاستلام أو عنوان التوصيل → إلى مدينة <strong>فرع إرجاع المركبة</strong>.
      </p>

      <label className="text-sm font-medium">
        من (مدينة الاستلام / التوصيل)
        <select
          name="fromCitySlug"
          required
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        >
          <option value="">— اختر —</option>
          {cities.map((c) => (
            <option key={c.id} value={c.slug}>
              {c.name} ({c.slug})
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium">
        إلى (مدينة فرع الإرجاع)
        <select
          name="toCitySlug"
          required
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        >
          <option value="">— اختر —</option>
          {cities.map((c) => (
            <option key={`t-${c.id}`} value={c.slug}>
              {c.name} ({c.slug})
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium">
        الرسوم (ريال، دون ضريبة)
        <input
          name="feeExclVatSar"
          type="number"
          min={0}
          max={500000}
          step={1}
          required
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 font-mono text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <label className="text-sm font-medium">
        ترتيب العرض
        <input
          name="sortOrder"
          type="number"
          defaultValue={0}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <label className="text-sm font-medium md:col-span-2">
        مفعّل
        <select
          name="isActive"
          defaultValue="true"
          className="mt-2 w-full max-w-xs rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        >
          <option value="true">نعم</option>
          <option value="false">لا</option>
        </select>
      </label>

      <div className="flex flex-wrap items-center gap-4 md:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="gradient-cta rounded-xl px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {pending ? "جاري الحفظ…" : "حفظ المسار"}
        </button>
        {state?.error ? (
          <p className="text-sm font-medium text-error" role="alert">
            {state.error}
          </p>
        ) : null}
        {state?.ok ? (
          <p className="text-sm font-bold text-primary" role="status">
            تم الحفظ.
          </p>
        ) : null}
      </div>
    </form>
  );
}
