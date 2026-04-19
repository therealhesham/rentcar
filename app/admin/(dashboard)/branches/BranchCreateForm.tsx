"use client";

import { useActionState } from "react";
import { createBranch } from "@/app/admin/branch-actions";
import { AdminImageField } from "@/components/admin/AdminImageField";

export function BranchCreateForm() {
  const [state, formAction, pending] = useActionState(createBranch, null);

  return (
    <form
      action={formAction}
      encType="multipart/form-data"
      className="mb-10 grid gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 md:grid-cols-2"
    >
      <h2 className="md:col-span-2 text-lg font-extrabold tracking-tight">
        إضافة فرع
      </h2>

      <label className="text-sm font-medium md:col-span-1">
        اسم الفرع (عربي)
        <input
          name="name"
          required
          placeholder="مثال: جدة"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>
      <label className="text-sm font-medium md:col-span-1">
        المعرّف (slug) — للنماذج والحجز
        <input
          name="slug"
          required
          placeholder="jeddah"
          dir="ltr"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 font-mono text-sm text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <label className="text-sm font-medium md:col-span-1">
        شعار قصير (اختياري)
        <input
          name="tagline"
          placeholder="فخامة ساحلية"
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

      <label className="text-sm font-medium md:col-span-1">
        نشط
        <select
          name="isActive"
          defaultValue="true"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        >
          <option value="true">نعم</option>
          <option value="false">لا</option>
        </select>
      </label>
      <label className="text-sm font-medium md:col-span-1">
        يظهر في «فروعنا الجديدة» بالرئيسية
        <select
          name="isNew"
          defaultValue="false"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        >
          <option value="false">لا</option>
          <option value="true">نعم</option>
        </select>
      </label>

      <label className="text-sm font-medium md:col-span-2">
        رابط صورة خارجي (https) — اختياري إن لم ترفع أو تختار من المعرض
        <input
          name="imageUrl"
          type="url"
          placeholder="https://..."
          dir="ltr"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <label className="text-sm font-medium md:col-span-2">
        وصف الصورة (alt)
        <input
          name="alt"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <AdminImageField
        label="صورة الفرع — من المعرض أو رفع ملف (اختياري)"
        fileHelp="يتطلب مجلد معرض «branches» وضبط Spaces. بحد أقصى 5 ميجابايت."
      />

      <div className="md:col-span-2 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="gradient-cta rounded-xl px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {pending ? "جاري الإضافة…" : "إضافة الفرع"}
        </button>
        {state?.error ? (
          <p className="text-sm font-medium text-error" role="alert">
            {state.error}
          </p>
        ) : null}
        {state?.ok ? (
          <p className="text-sm font-bold text-primary" role="status">
            تم إنشاء الفرع.
          </p>
        ) : null}
      </div>
    </form>
  );
}
