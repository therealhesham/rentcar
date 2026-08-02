"use client";

import { useActionState } from "react";
import { setAdminJobRoleActive } from "@/app/admin/job-role-actions";

export function AdminJobRoleToggleForm({
  jobRoleId,
  isActive,
}: {
  jobRoleId: number;
  isActive: boolean;
}) {
  const [state, formAction, pending] = useActionState(setAdminJobRoleActive, null);

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="jobRoleId" value={jobRoleId} />
      <input type="hidden" name="isActive" value={isActive ? "false" : "true"} />
      <button
        type="submit"
        disabled={pending}
        className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-60 ${
          isActive
            ? "border-error/40 text-error hover:bg-error-container/30"
            : "border-primary/40 text-primary hover:bg-primary-container/30"
        }`}
      >
        {pending ? "…" : isActive ? "تعطيل" : "تفعيل"}
      </button>
      {state?.error ? (
        <span className="ms-2 text-xs font-bold text-error">{state.error}</span>
      ) : null}
    </form>
  );
}
