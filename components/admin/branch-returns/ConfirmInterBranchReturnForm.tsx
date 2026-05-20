"use client";

import { useRouter } from "next/navigation";
import { useActionState, useEffect } from "react";
import { confirmInterBranchReturnAction } from "@/app/admin/branch-return-actions";

type Props = {
  bookingRequestId: number;
};

export function ConfirmInterBranchReturnForm({ bookingRequestId }: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(confirmInterBranchReturnAction, null);

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state?.ok, router]);

  if (state?.ok) {
    return (
      <span className="inline-flex items-center rounded-full bg-primary-container/50 px-3 py-1 text-xs font-bold text-primary">
        تم التأكيد ✓
      </span>
    );
  }

  return (
    <form action={formAction} className="flex flex-col items-stretch gap-1">
      <input type="hidden" name="bookingRequestId" value={bookingRequestId} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-[#003749] px-3 py-1.5 text-xs font-bold text-white hover:opacity-95 disabled:opacity-60"
      >
        {pending ? "…" : "موافق — استلام"}
      </button>
      {state?.error ? (
        <span className="max-w-[10rem] text-[10px] font-medium leading-tight text-error">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
