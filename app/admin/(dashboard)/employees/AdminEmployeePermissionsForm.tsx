"use client";

import { useActionState, useState } from "react";
import { updateAdminEmployeePermissions } from "@/app/admin/admin-employee-actions";
import { AdminPermissionsFieldset } from "@/app/admin/(dashboard)/employees/AdminPermissionsFieldset";

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
