"use client";

import { useActionState, useEffect, useRef } from "react";
import { createAdminEmployee } from "@/app/admin/admin-employee-actions";

type BranchOption = { id: number; name: string; slug: string };

export function AdminEmployeeCreateForm({ branches }: { branches: BranchOption[] }) {
  const [state, formAction, pending] = useActionState(createAdminEmployee, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) {
      formRef.current?.reset();
    }
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="mb-10 grid gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 md:grid-cols-2"
    >
      <h2 className="md:col-span-2 text-lg font-extrabold tracking-tight">
        إضافة موظف فرع
      </h2>
      <p className="md:col-span-2 text-sm text-on-surface-variant">
        يُنشأ حساب دخول للوحة الإدارة مرتبطاً بفرع واحد. يرى الموظف حجوزات وعملاء ومركبات ذلك الفرع فقط.
      </p>

      <label className="text-sm font-medium md:col-span-1">
        الفرع
        <select
          name="branchId"
          required
          defaultValue={branches[0]?.id ?? ""}
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        >
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.slug})
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium md:col-span-1">
        الاسم (اختياري)
        <input
          name="name"
          placeholder="مثال: أحمد — موظف جدة"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <label className="text-sm font-medium md:col-span-1">
        البريد الإلكتروني (اسم الدخول)
        <input
          name="email"
          type="email"
          required
          dir="ltr"
          autoComplete="off"
          placeholder="employee@example.com"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <label className="text-sm font-medium md:col-span-1">
        كلمة المرور المؤقتة
        <input
          name="password"
          type="password"
          required
          minLength={6}
          autoComplete="new-password"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      {state?.error ? (
        <p className="md:col-span-2 rounded-xl bg-error-container/40 px-3 py-2 text-sm font-bold text-error">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="md:col-span-2 rounded-xl bg-primary-container/50 px-3 py-2 text-sm font-bold text-on-primary-container">
          تم إنشاء الحساب. سلّم الموظف البريد وكلمة المرور لتسجيل الدخول من /admin/login
        </p>
      ) : null}

      <div>
        <button
          type="submit"
          disabled={pending || branches.length === 0}
          className="gradient-cta rounded-xl px-6 py-3 text-sm font-extrabold text-white disabled:opacity-60"
        >
          {pending ? "جاري الحفظ…" : "إضافة الموظف"}
        </button>
      </div>
    </form>
  );
}
