"use client";

import { useActionState, useState } from "react";
import { updateAdminEmployeePermissions } from "@/app/admin/admin-employee-actions";
import { AdminPermissionsFieldset } from "@/app/admin/(dashboard)/employees/AdminPermissionsFieldset";

export function AdminEmployeePermissionsForm({
  employeeId,
  currentPermissions,
  jobRoles,
  jobRoleId,
}: {
  employeeId: number;
  currentPermissions: string[];
  jobRoles: { id: number; name: string }[];
  jobRoleId: number | null;
}) {
  const [open, setOpen] = useState(false);
  const [state, formAction, pending] = useActionState(updateAdminEmployeePermissions, null);
  const current = new Set(currentPermissions);

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="rounded-lg border border-outline-variant/50 px-3 py-1.5 text-xs font-bold text-on-surface transition-colors hover:bg-surface-container-low"
      >
        {open ? "إغلاق" : "تعديل الوظيفة والصلاحيات"}
      </button>

      {open ? (
        <form action={formAction} className="mt-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4">
          <input type="hidden" name="employeeId" value={employeeId} />
          <label className="mb-3 block text-sm font-medium">
            الوظيفة
            <select
              name="jobRoleId"
              defaultValue={jobRoleId ?? ""}
              className="mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2"
            >
              <option value="">— بدون وظيفة —</option>
              {jobRoles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                </option>
              ))}
            </select>
          </label>
          <p className="mb-2 text-xs font-bold text-on-surface-variant">
            صلاحيات إضافية فوق صلاحيات الوظيفة
          </p>
          <AdminPermissionsFieldset currentPermissions={current} />

          {state?.error ? (
            <p className="mt-3 text-xs font-bold text-error">{state.error}</p>
          ) : null}
          {state?.ok ? (
            <p className="mt-3 text-xs font-bold text-primary">تم حفظ الصلاحيات.</p>
          ) : null}

          <button
            type="submit"
            disabled={pending}
            className="mt-3 rounded-xl bg-primary px-4 py-2 text-xs font-bold text-on-primary disabled:opacity-60"
          >
            {pending ? "جاري الحفظ…" : "حفظ الصلاحيات"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
