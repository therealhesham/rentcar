"use client";

import { useActionState } from "react";
import { deleteRentalDiscount, type ActionState } from "@/app/admin/rental-discount-actions";

export function RentalDiscountDeleteForm({ id, labelAr }: { id: number; labelAr: string }) {
  const [state, formAction, pending] = useActionState(deleteRentalDiscount, null as ActionState | null);

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        onClick={(e) => {
          if (!confirm(`حذف الخصم «${labelAr}»؟`)) e.preventDefault();
        }}
        className="rounded-lg border border-error/40 px-3 py-1.5 text-xs font-bold text-error hover:bg-error/5 disabled:opacity-60"
      >
        {pending ? "…" : "حذف"}
      </button>
      {state?.error ? <span className="ms-2 text-xs text-error">{state.error}</span> : null}
    </form>
  );
}
