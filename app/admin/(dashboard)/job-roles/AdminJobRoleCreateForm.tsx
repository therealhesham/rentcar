"use client";

import { useActionState, useEffect, useRef } from "react";
import { createAdminJobRole } from "@/app/admin/job-role-actions";
import { AdminPermissionsFieldset } from "@/app/admin/(dashboard)/employees/AdminPermissionsFieldset";

export function AdminJobRoleCreateForm() {
  const [state, formAction, pending] = useActionState(createAdminJobRole, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="mb-10 grid gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6"
    >
      <h2 className="text-lg font-extrabold tracking-tight">إضافة وظيفة</h2>
      <p className="text-sm text-on-surface-variant">
        الوظيفة تحدد الصفحات التي يراها الموظف. أما نطاق البيانات (فرع واحد / كل فروع مدينة /
        كل الفروع) فيأتي من فرع الموظف أو مدينته وليس من الوظيفة.
      </p>

      <label className="text-sm font-medium">
        اسم الوظيفة
        <input
          name="name"
          required
          placeholder="مثال: محاسب"
          className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
        />
      </label>

      <div>
        <p className="mb-2 text-sm font-medium">صلاحيات الوظيفة</p>
        <AdminPermissionsFieldset />
      </div>

      {state?.error ? <p className="text-sm font-bold text-error">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm font-bold text-primary">تمت إضافة الوظيفة.</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="justify-self-start rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary disabled:opacity-60"
      >
        {pending ? "جاري الحفظ…" : "إضافة الوظيفة"}
      </button>
    </form>
  );
}
