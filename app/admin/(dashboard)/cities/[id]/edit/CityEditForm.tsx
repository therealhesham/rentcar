"use client";

import { useActionState } from "react";
import Link from "next/link";
import { updateCity } from "@/app/admin/city-actions";

type City = {
  id: number;
  slug: string;
  name: string;
  sortOrder: number;
  isActive: boolean;
};

type Props = { city: City };

export function CityEditForm({ city }: Props) {
  const [state, formAction, pending] = useActionState(updateCity, null);

  return (
    <form
      action={formAction}
      className="grid gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 md:grid-cols-2"
    >
      <input type="hidden" name="id" value={city.id} />

      <h2 className="md:col-span-2 text-lg font-extrabold tracking-tight">تعديل المدينة</h2>

      <label className="text-sm font-medium md:col-span-1">
        اسم المدينة
        <input
          name="name"
          required
          defaultValue={city.name}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>
      <label className="text-sm font-medium md:col-span-1">
        المعرّف (slug)
        <input
          name="slug"
          required
          defaultValue={city.slug}
          dir="ltr"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 font-mono text-sm text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <label className="text-sm font-medium md:col-span-1">
        ترتيب العرض
        <input
          name="sortOrder"
          type="number"
          defaultValue={city.sortOrder}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <label className="text-sm font-medium md:col-span-1">
        نشط
        <select
          name="isActive"
          defaultValue={city.isActive ? "true" : "false"}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        >
          <option value="true">نعم</option>
          <option value="false">لا</option>
        </select>
      </label>

      <div className="md:col-span-2 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="gradient-cta rounded-xl px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {pending ? "جاري الحفظ…" : "حفظ التعديلات"}
        </button>
        <Link
          href="/admin/cities"
          className="rounded-xl border border-outline-variant px-6 py-2.5 text-sm font-bold text-primary hover:bg-surface-container"
        >
          رجوع للقائمة
        </Link>
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
