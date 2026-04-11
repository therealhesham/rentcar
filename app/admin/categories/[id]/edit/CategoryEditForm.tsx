"use client";

import { useActionState } from "react";
import Link from "next/link";
import { updateFleetCategory } from "@/app/admin/category-actions";

type Category = {
  id: number;
  slug: string;
  title: string;
  description: string;
  image: string;
  alt: string | null;
  sortOrder: number;
};

type Props = {
  category: Category;
};

export function CategoryEditForm({ category }: Props) {
  const [state, formAction, pending] = useActionState(updateFleetCategory, null);

  return (
    <form
      action={formAction}
      encType="multipart/form-data"
      className="grid gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 md:grid-cols-2"
    >
      <input type="hidden" name="id" value={category.id} />
      <input type="hidden" name="currentImage" value={category.image} />

      <h2 className="md:col-span-2 text-lg font-extrabold tracking-tight">
        تعديل الفئة
      </h2>

      <label className="text-sm font-medium md:col-span-1">
        عنوان الفئة
        <input
          name="title"
          required
          defaultValue={category.title}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>
      <label className="text-sm font-medium md:col-span-1">
        المعرّف (slug)
        <input
          name="slug"
          required
          defaultValue={category.slug}
          dir="ltr"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <label className="text-sm font-medium md:col-span-2">
        الوصف
        <textarea
          name="description"
          required
          rows={4}
          defaultValue={category.description}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <div className="md:col-span-2">
        <p className="text-sm font-medium">الصورة الحالية</p>
        <div className="relative mt-2 aspect-[16/9] max-w-[240px] overflow-hidden rounded-xl border border-outline-variant bg-surface-container">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={category.image}
            alt={category.alt ?? category.title}
            className="h-full w-full object-cover"
          />
        </div>
        <label className="mt-4 block text-sm font-medium">
          استبدال الصورة (اختياري)
          <input
            name="imageFile"
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            className="mt-2 block w-full text-sm text-on-surface file:me-4 file:rounded-lg file:border-0 file:bg-primary-container file:px-4 file:py-2 file:text-sm file:font-bold file:text-on-primary-container"
          />
          <span className="mt-1 block text-xs text-on-surface-variant">
            اترك الحقل فارغاً للإبقاء على الصورة الحالية. بحد أقصى 5 ميجابايت.
          </span>
        </label>
      </div>
      <label className="text-sm font-medium md:col-span-1">
        وصف الصورة (alt)
        <input
          name="alt"
          defaultValue={category.alt ?? ""}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>
      <label className="text-sm font-medium md:col-span-1">
        ترتيب العرض
        <input
          name="sortOrder"
          type="number"
          defaultValue={category.sortOrder}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
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
          href="/admin/categories"
          className="rounded-xl border border-outline-variant px-4 py-2.5 text-sm font-bold text-on-surface-variant hover:bg-surface-container"
        >
          إلغاء
        </Link>
        {state?.ok ? (
          <p className="text-sm font-bold text-primary" role="status">
            تم حفظ التعديلات.
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
