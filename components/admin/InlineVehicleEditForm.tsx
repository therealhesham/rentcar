"use client";

import { useActionState, useRef } from "react";
import { updateVehicleField } from "@/app/admin/actions";

type Props = {
  modelId: number;
  field:
    | "year"
    | "chairs"
    | "price"
    | "priceMonthlyExclTax"
    | "minPricePerDayExclTax"
    | "minPriceMonthlyExclTax";
  defaultValue: number;
};

export function InlineVehicleEditForm({ modelId, field, defaultValue }: Props) {
  const [state, formAction, pending] = useActionState(updateVehicleField, null);
  const formRef = useRef<HTMLFormElement>(null);

  // Auto-submit when input loses focus
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    // Only submit if the value has changed and is valid
    const val = Number(e.target.value);
    if (!Number.isFinite(val) || val === defaultValue) {
      // If empty or same, just reset
      e.target.value = defaultValue.toString();
      return;
    }
    formRef.current?.requestSubmit();
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur(); // Trigger blur which triggers submit
    } else if (e.key === "Escape") {
      e.currentTarget.value = defaultValue.toString();
      e.currentTarget.blur(); // Reset and remove focus without submit
    }
  };

  return (
    <form ref={formRef} action={formAction} className="relative inline-block w-20">
      <input type="hidden" name="modelId" value={modelId} />
      <input type="hidden" name="field" value={field} />
      <input
        type="number"
        name="value"
        defaultValue={defaultValue}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        disabled={pending}
        className="w-full rounded-lg border border-outline-variant/30 bg-surface-container-low px-1.5 py-1 text-center font-bold tabular-nums text-on-surface transition-colors hover:border-outline-variant/60 hover:bg-surface-container focus:border-primary focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary disabled:opacity-50"
        dir="ltr"
      />
      {state?.error && (
        <span className="absolute -bottom-5 start-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] text-error">
          {state.error}
        </span>
      )}
    </form>
  );
}
