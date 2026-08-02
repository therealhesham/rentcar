"use client";

import { useActionState } from "react";
import { updateAdminEmployeeNotificationPref } from "@/app/admin/admin-employee-actions";

type CityOption = { id: number; name: string };

export function AdminEmployeeNotifyToggleForm({
  employeeId,
  hasBranch,
  cities,
  cityId,
  notifyOnBookingEmail,
  notifyGlobalTo,
  notifyGlobalCc,
}: {
  employeeId: number;
  /** موظف مرتبط بفرع محدد لا يمكن ضبط مدينة له — نفس القيد في الخادم. */
  hasBranch: boolean;
  cities: CityOption[];
  cityId: number | null;
  notifyOnBookingEmail: boolean;
  notifyGlobalTo: boolean;
  notifyGlobalCc: boolean;
}) {
  const [state, formAction, pending] = useActionState(updateAdminEmployeeNotificationPref, null);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2 text-xs">
      <input type="hidden" name="employeeId" value={employeeId} />

      {!hasBranch && cities.length > 0 ? (
        <select
          name="cityId"
          defaultValue={cityId ?? ""}
          className="rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-2 py-1.5 font-bold text-on-surface-variant"
        >
          <option value="">بلا مدينة</option>
          {cities.map((c) => (
            <option key={c.id} value={c.id}>
              مشرف {c.name}
            </option>
          ))}
        </select>
      ) : null}

      <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-2 py-1.5 font-bold text-on-surface-variant">
        <input
          type="checkbox"
          name="notifyOnBookingEmail"
          defaultChecked={notifyOnBookingEmail}
          className="h-3.5 w-3.5 rounded border-outline text-primary focus:ring-primary"
        />
        إشعار
      </label>
      <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-2 py-1.5 font-bold text-on-surface-variant">
        <input
          type="checkbox"
          name="notifyGlobalTo"
          defaultChecked={notifyGlobalTo}
          className="h-3.5 w-3.5 rounded border-outline text-primary focus:ring-primary"
        />
        TO عام
      </label>
      <label className="flex cursor-pointer items-center gap-1.5 rounded-lg border border-outline-variant/50 bg-surface-container-lowest px-2 py-1.5 font-bold text-on-surface-variant">
        <input
          type="checkbox"
          name="notifyGlobalCc"
          defaultChecked={notifyGlobalCc}
          className="h-3.5 w-3.5 rounded border-outline text-primary focus:ring-primary"
        />
        CC عام
      </label>

      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-primary/40 px-3 py-1.5 font-bold text-primary transition-colors hover:bg-primary-container/30 disabled:opacity-60"
      >
        {pending ? "…" : "حفظ الإيميل"}
      </button>
      {state?.error ? <span className="font-bold text-error">{state.error}</span> : null}
    </form>
  );
}
