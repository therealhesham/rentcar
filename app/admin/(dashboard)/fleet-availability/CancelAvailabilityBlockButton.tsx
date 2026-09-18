"use client";

import { useActionState } from "react";
import { cancelAvailabilityBlockAction } from "@/app/admin/availability-import-actions";

export function CancelAvailabilityBlockButton({ id }: { id: number }) {
  const [state, formAction, pending] = useActionState(cancelAvailabilityBlockAction, null);

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="id" value={id} />
      {state && !state.ok && state.error && (
        <span className="me-2 text-xs font-bold text-error">{state.error}</span>
      )}
      <button
        type="submit"
        disabled={pending}
        onClick={(e) => {
          if (!confirm("هل تريد إلغاء هذا الحجب؟ العربية هتظهر متاحة فوراً لنفس الفترة.")) {
            e.preventDefault();
          }
        }}
        className="rounded-lg border border-error/30 bg-error/5 px-3 py-1.5 text-xs font-bold text-error transition-colors hover:bg-error/10 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "جاري الإلغاء..." : "إلغاء الحجب"}
      </button>
    </form>
  );
}
