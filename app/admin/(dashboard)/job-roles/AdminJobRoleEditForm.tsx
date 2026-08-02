"use client";

import { useActionState, useState } from "react";
import { updateAdminJobRole } from "@/app/admin/job-role-actions";
import { AdminPermissionsFieldset } from "@/app/admin/(dashboard)/employees/AdminPermissionsFieldset";

export function AdminJobRoleEditForm({
  jobRoleId,
  name,
  currentPermissions,
}: {
  jobRoleId: number;
  name: string;
  currentPermissions: string[];
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateAdminJobRole, null);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-outline-variant/50 px-3 py-1.5 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container-low"
      >
        {open ? "إغلاق" : "تعديل الوظيفة"}
      </button>

      {open ? (
        <form
          action={formAction}
          className="mt-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4"
        >
          <input type="hidden" name="jobRoleId" value={jobRoleId} />
          <label className="mb-3 block text-sm font-medium">
            اسم الوظيفة
            <input
              name="name"
              required
              defaultValue={name}
              className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
            />
          </label>

          <AdminPermissionsFieldset currentPermissions={new Set(currentPermissions)} />

          {state?.error ? (
            <p className="mt-3 text-xs font-bold text-error">{state.error}</p>
          ) : null}
          {state?.ok ? (
            <p className="mt-3 text-xs font-bold text-primary">
              تم الحفظ — يسري على الموظفين عند تسجيل الدخول التالي.
            </p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="mt-3 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary disabled:opacity-60"
          >
            {pending ? "جاري الحفظ…" : "حفظ"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
