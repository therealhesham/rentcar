"use client";

import { useActionState, useRef } from "react";
import { updateVehicleField } from "@/app/admin/actions";

type Props = {
  modelId: number;
  defaultValue: number;
  categories: { id: number; title: string }[];
};

export function InlineCategoryEditForm({ modelId, defaultValue, categories }: Props) {
  const [state, formAction, pending] = useActionState(updateVehicleField, null);
  const formRef = useRef<HTMLFormElement>(null);

  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    if (Number(e.target.value) === defaultValue) return;
    formRef.current?.requestSubmit();
  };

  return (
    <form ref={formRef} action={formAction} className="relative inline-block w-full max-w-[7rem]">
      <input type="hidden" name="modelId" value={modelId} />
      <input type="hidden" name="field" value="categoryId" />
      <select
        name="value"
        defaultValue={defaultValue}
        onChange={handleChange}
        disabled={pending}
        className="w-full appearance-none rounded-full border border-transparent bg-surface-container px-2.5 py-0.5 text-center text-[11px] font-bold text-on-surface-variant outline-none transition-colors hover:border-outline-variant/50 focus:border-primary focus:bg-surface-container-lowest focus:ring-1 focus:ring-primary disabled:opacity-50"
      >
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>
      {state?.error && (
        <span className="absolute -bottom-5 start-1/2 w-max -translate-x-1/2 whitespace-nowrap text-[10px] text-error">
          {state.error}
        </span>
      )}
    </form>
  );
}
