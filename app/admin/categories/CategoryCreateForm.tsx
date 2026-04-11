"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createFleetCategory } from "@/app/admin/category-actions";

export function CategoryCreateForm() {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(createFleetCategory, null);

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
    }
  }, [state?.ok, router]);

  return (
    <form
      action={formAction}
      encType="multipart/form-data"
      className="mb-12 grid gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 md:grid-cols-2"
    >
      <h2 className="md:col-span-2 text-lg font-extrabold tracking-tight">
        إضافة فئة جديدة
      </h2>

      <label className="text-sm font-medium md:col-span-1">
        عنوان الفئة
        <input
          name="title"
          required
          placeholder="مثال: سيدان"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>
      <label className="text-sm font-medium md:col-span-1">
        المعرّف (slug) — إنجليزي للرابط
        <input
          name="slug"
          required
          placeholder="مثال: sedan"
          dir="ltr"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <label className="text-sm font-medium md:col-span-2">
        الوصف
        <textarea
          name="description"
          required
          rows={3}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <label className="text-sm font-medium md:col-span-2">
        صورة الفئة (DigitalOcean Spaces)
        <input
          name="imageFile"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          required
          className="mt-2 block w-full text-sm text-on-surface file:me-4 file:rounded-lg file:border-0 file:bg-primary-container file:px-4 file:py-2 file:text-sm file:font-bold file:text-on-primary-container"
        />
        <span className="mt-1 block text-xs text-on-surface-variant">
          بحد أقصى 5 ميجابايت — JPEG أو PNG أو WebP أو GIF.
        </span>
      </label>
      <label className="text-sm font-medium md:col-span-1">
        وصف الصورة (alt)
        <input
          name="alt"
          placeholder="اختياري"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>
      <label className="text-sm font-medium md:col-span-1">
        ترتيب العرض
        <input
          name="sortOrder"
          type="number"
          defaultValue={0}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <div className="md:col-span-2 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="gradient-cta rounded-xl px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {pending ? "جاري الحفظ…" : "إضافة الفئة"}
        </button>
        {state?.ok ? (
          <p className="text-sm font-bold text-primary" role="status">
            تم إنشاء الفئة.
          </p>
        ) : null}
        {state?.error ? (
          <p className="text-sm font-bold text-error" role="alert">
            {state.error}
          </p>
        ) : null}
      </div>
    </form>
  );
}
