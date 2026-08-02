"use client";

import { useActionState, useEffect, useRef } from "react";
import { createAdminEmployee } from "@/app/admin/admin-employee-actions";
import { AdminPermissionsFieldset } from "@/app/admin/(dashboard)/employees/AdminPermissionsFieldset";

type BranchOption = { id: number; name: string; slug: string };
type CityOption = { id: number; name: string };
type JobRoleOption = { id: number; name: string };

export function AdminEmployeeCreateForm({
  branches,
  cities,
  jobRoles,
}: {
  branches: BranchOption[];
  cities: CityOption[];
  jobRoles: JobRoleOption[];
}) {
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
        إضافة موظف
      </h2>
      <p className="md:col-span-2 text-sm text-on-surface-variant">
        أدخل بيانات الموظف والصلاحيات الممنوحة له. يمكن اختيار "الإدارة المركزية" إذا كان الموظف يعمل للإدارة ويرى كافة الفروع.
      </p>

      <label className="text-sm font-medium md:col-span-1">
        الفرع
        <select
          name="branchId"
          defaultValue=""
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        >
          <option value="">— بدون فرع محدد —</option>
          {branches.map((b) => (
            <option key={b.id} value={b.id}>
              {b.name} ({b.slug})
            </option>
          ))}
        </select>
      </label>

      <label className="text-sm font-medium md:col-span-1">
        أو مشرف مدينة كاملة (بدلاً من الفرع)
        <select
          name="cityId"
          defaultValue=""
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        >
          <option value="">— الإدارة المركزية / بدون —</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <span className="mt-1 block text-xs font-normal text-on-surface-variant">
          يستقبل TO على إيميلات كل فروع هذه المدينة — لا تختره مع فرع محدد
        </span>
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
      <div className="grid gap-2 md:col-span-2">
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-3 text-sm font-medium">
          <input
            type="checkbox"
            name="notifyOnBookingEmail"
            className="h-4 w-4 rounded border-outline text-primary focus:ring-primary"
          />
          أرسل إيميل تلقائي عند حجز جديد (لموظف الفرع أو مشرف المدينة المطابق)
        </label>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-3 text-sm font-medium">
          <input
            type="checkbox"
            name="notifyGlobalTo"
            className="h-4 w-4 rounded border-outline text-primary focus:ring-primary"
          />
          TO على كل الإيميلات بلا استثناء (مثل مشرف العمليات)
        </label>
        <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-outline-variant/50 bg-surface-container-lowest p-3 text-sm font-medium">
          <input
            type="checkbox"
            name="notifyGlobalCc"
            className="h-4 w-4 rounded border-outline text-primary focus:ring-primary"
          />
          CC ثابت على كل الإيميلات (مثل المحاسب أو المدير المالي)
        </label>
      </div>

      <div className="md:col-span-2 mt-2 border-t border-outline-variant/30 pt-4">
        <label className="mb-3 block text-sm font-medium">
          الوظيفة
          <select
            name="jobRoleId"
            defaultValue=""
            className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
          >
            <option value="">— بدون وظيفة —</option>
            {jobRoles.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-xs font-normal text-on-surface-variant">
            الوظيفة تمنح مجموعة صلاحيات جاهزة — تُدار من صفحة «الوظائف والصلاحيات»
          </span>
        </label>
        <label className="mb-3 block text-sm font-bold text-on-surface">
          صلاحيات إضافية (فوق صلاحيات الوظيفة)
        </label>
        <AdminPermissionsFieldset />
      </div>
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
