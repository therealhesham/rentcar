"use client";

import { useActionState } from "react";
import { updateAdminEmployeeNotificationPref } from "@/app/admin/admin-employee-actions";

export function AdminEmployeeNotifyToggleForm({
  employeeId,
  notifyOnBookingEmail,
}: {
  employeeId: number;
  notifyOnBookingEmail: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateAdminEmployeeNotificationPref, null);

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="employeeId" value={employeeId} />
      <input type="hidden" name="notifyOnBookingEmail" value={notifyOnBookingEmail ? "false" : "true"} />
      <button
        type="submit"
        disabled={pending}
        className={`rounded-lg border px-3 py-1.5 text-xs font-bold transition-colors disabled:opacity-60 ${
          notifyOnBookingEmail
            ? "border-primary/40 text-primary hover:bg-primary-container/30"
            : "border-outline-variant/50 text-on-surface-variant hover:bg-surface-container-low"
        }`}
      >
        {pending ? "…" : notifyOnBookingEmail ? "إشعار الإيميل: مفعّل" : "إشعار الإيميل: معطّل"}
      </button>
      {state?.error ? (
        <span className="ms-2 text-xs font-bold text-error">{state.error}</span>
      ) : null}
    </form>
  );
}
