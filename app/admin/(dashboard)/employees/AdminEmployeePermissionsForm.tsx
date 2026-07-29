"use client";

import { useActionState, useState } from "react";
import { updateAdminEmployeePermissions } from "@/app/admin/admin-employee-actions";
import { ADMIN_PERMISSIONS, ADMIN_PERMISSION_LABELS } from "@/lib/admin-permissions";

export function AdminEmployeePermissionsForm({
  employeeId,
  currentPermissions,
}: {
  employeeId: number;
  currentPermissions: string[];
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
        {open ? "إغلاق" : "تعديل الصلاحيات"}
      </button>

      {open ? (
        <form action={formAction} className="mt-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-4">
          <input type="hidden" name="employeeId" value={employeeId} />
          <div className="grid gap-2 sm:grid-cols-2">
            {ADMIN_PERMISSIONS.map((perm) => (
              <label
                key={perm}
                className="flex cursor-pointer items-center gap-2 rounded-lg border border-outline-variant/40 bg-white p-2.5 hover:bg-surface-container-low"
              >
                <input
                  type="checkbox"
                  name="permissions"
                  value={perm}
                  defaultChecked={current.has(perm)}
                  className="h-4 w-4 rounded border-outline text-primary focus:ring-primary"
                />
                <span className="text-xs font-medium text-on-surface">
                  {ADMIN_PERMISSION_LABELS[perm]}
                </span>
              </label>
            ))}
          </div>

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
