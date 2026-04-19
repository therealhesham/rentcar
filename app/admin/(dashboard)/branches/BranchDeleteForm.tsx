"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { deleteBranch } from "@/app/admin/branch-actions";

type Props = {
  id: number;
  name: string;
};

export function BranchDeleteForm({ id, name }: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState(deleteBranch, null);

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
    }
  }, [state?.ok, router]);

  return (
    <form action={formAction} className="inline-flex flex-col items-end gap-1">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-error/40 px-3 py-1.5 text-xs font-bold text-error transition-colors hover:bg-error-container/30 disabled:opacity-60"
        title={`حذف ${name}`}
      >
        {pending ? "…" : "حذف"}
      </button>
      {state?.error ? (
        <span
          className="max-w-[200px] text-end text-[11px] font-medium text-error"
          role="alert"
        >
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
