"use client";

import { useActionState } from "react";
import { updateBranchFleetQuantity } from "@/app/admin/branch-fleet-actions";

type Props = {
  modelId: number;
  branchId: number;
  defaultQuantity: number;
};

export function BranchFleetQuantityForm({ modelId, branchId, defaultQuantity }: Props) {
  const [state, formAction, pending] = useActionState(updateBranchFleetQuantity, null);

  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="modelId" value={modelId} />
      <input type="hidden" name="branchId" value={branchId} />
      <input
        type="number"
        name="quantity"
        min={0}
        max={500}
        defaultValue={defaultQuantity}
        className="w-20 rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm font-bold tabular-nums outline-none focus:ring-2 focus:ring-primary"
        dir="ltr"
      />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-on-primary hover:opacity-95 disabled:opacity-60"
      >
        {pending ? "…" : "حفظ"}
      </button>
      {state?.error ? (
        <span className="text-xs font-medium text-error">{state.error}</span>
      ) : state?.ok ? (
        <span className="text-xs font-medium text-primary">تم</span>
      ) : null}
    </form>
  );
}
