"use client";

import { useActionState } from "react";
import Link from "next/link";
import { updateBranch } from "@/app/admin/branch-actions";
import { AdminImageField } from "@/components/admin/AdminImageField";

type Branch = {
  id: number;
  slug: string;
  name: string;
  tagline: string | null;
  image: string | null;
  alt: string | null;
  sortOrder: number;
  isActive: boolean;
  isNew: boolean;
};

type Props = {
  branch: Branch;
};

export function BranchEditForm({ branch }: Props) {
  const [state, formAction, pending] = useActionState(updateBranch, null);

  return (
    <form
      action={formAction}
      encType="multipart/form-data"
      className="grid gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 md:grid-cols-2"
    >
      <input type="hidden" name="id" value={branch.id} />
      <input type="hidden" name="currentImage" value={branch.image ?? ""} />

      <h2 className="md:col-span-2 text-lg font-extrabold tracking-tight">
        تعديل الفرع
      </h2>

      <label className="text-sm font-medium md:col-span-1">
        اسم الفرع
        <input
          name="name"
          required
          defaultValue={branch.name}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>
      <label className="text-sm font-medium md:col-span-1">
        المعرّف (slug)
        <input
          name="slug"
          required
          defaultValue={branch.slug}
          dir="ltr"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 font-mono text-sm text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <label className="text-sm font-medium md:col-span-1">
        شعار قصير
        <input
          name="tagline"
          defaultValue={branch.tagline ?? ""}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>
      <label className="text-sm font-medium md:col-span-1">
        ترتيب العرض
        <input
          name="sortOrder"
          type="number"
          defaultValue={branch.sortOrder}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <label className="text-sm font-medium md:col-span-1">
        نشط
        <select
          name="isActive"
          defaultValue={branch.isActive ? "true" : "false"}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        >
          <option value="true">نعم</option>
          <option value="false">لا</option>
        </select>
      </label>
      <label className="text-sm font-medium md:col-span-1">
        «فروعنا الجديدة» بالرئيسية
        <select
          name="isNew"
          defaultValue={branch.isNew ? "true" : "false"}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        >
          <option value="false">لا</option>
          <option value="true">نعم</option>
        </select>
      </label>

      <label className="text-sm font-medium md:col-span-2">
        رابط صورة خارجي (https) — يُستخدم إن لم تختر معرضًا أو ملفًا
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
          defaultValue={branch.alt ?? ""}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <AdminImageField
        label="صورة الفرع — استبدال من المعرض أو رفع ملف (اختياري)"
        currentImageUrl={branch.image}
        fileHelp="اترك الحقول فارغة للإبقاء على الصورة الحالية أو الرابط المحفوظ."
      />

      <div className="md:col-span-2 flex flex-wrap items-center gap-4">
        <button
          type="submit"
          disabled={pending}
          className="gradient-cta rounded-xl px-6 py-2.5 text-sm font-bold text-white disabled:opacity-60"
        >
          {pending ? "جاري الحفظ…" : "حفظ التعديلات"}
        </button>
        <Link
          href="/admin/branches"
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
