"use client";

import { useActionState } from "react";
import { deleteCouponCode, type ActionState } from "@/app/admin/coupon-code-actions";

export function CouponCodeDeleteForm({ id, code }: { id: number; code: string }) {
  const [state, formAction, pending] = useActionState(deleteCouponCode, null as ActionState | null);

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        onClick={(e) => {
          if (!confirm(`حذف الكود «${code}»؟`)) e.preventDefault();
        }}
        className="rounded-lg border border-error/40 px-3 py-1.5 text-xs font-bold text-error hover:bg-error/5 disabled:opacity-60"
      >
        {pending ? "…" : "حذف"}
      </button>
      {state?.error ? <span className="ms-2 text-xs text-error">{state.error}</span> : null}
    </form>
  );
}
