"use client";

import { useActionState } from "react";
import { updateBranchFleetQuantity } from "@/app/admin/branch-fleet-actions";

type Props = {
  modelId: number;
  branchId: number;
  defaultQuantity: number;
  /** عرض مضغوط داخل جدول السوبر أدمن */
  compact?: boolean;
};

export function BranchFleetQuantityForm({
  modelId,
  branchId,
  defaultQuantity,
  compact = false,
}: Props) {
  const [state, formAction, pending] = useActionState(updateBranchFleetQuantity, null);

  return (
    <form
      action={formAction}
      className={
        compact
          ? "flex w-full max-w-[5.5rem] flex-col items-stretch gap-1"
          : "flex flex-wrap items-center gap-2"
      }
    >
      <input type="hidden" name="modelId" value={modelId} />
      <input type="hidden" name="branchId" value={branchId} />
      <input
        type="number"
        name="quantity"
        min={0}
        max={500}
        defaultValue={defaultQuantity}
        className={
          compact
            ? "w-full rounded-md border border-outline-variant bg-surface-container-lowest px-1.5 py-1 text-center text-xs font-bold tabular-nums outline-none focus:ring-2 focus:ring-primary"
            : "w-20 rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm font-bold tabular-nums outline-none focus:ring-2 focus:ring-primary"
        }
        dir="ltr"
      />
      <button
        type="submit"
        disabled={pending}
        className={
          compact
            ? "rounded-md bg-primary px-2 py-1 text-[10px] font-bold text-on-primary hover:opacity-95 disabled:opacity-60"
            : "rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-on-primary hover:opacity-95 disabled:opacity-60"
        }
      >
        {pending ? "…" : "حفظ"}
      </button>
      {state?.error ? (
        <span className="text-[10px] font-medium leading-tight text-error">{state.error}</span>
      ) : state?.ok ? (
        <span className="text-[10px] font-medium text-primary">تم</span>
      ) : null}
    </form>
  );
}
