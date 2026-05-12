"use client";

import { useActionState } from "react";
import { deleteCity } from "@/app/admin/city-actions";

type Props = { id: number; name: string };

export function CityDeleteForm({ id, name }: Props) {
  const [state, formAction, pending] = useActionState(deleteCity, null);

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="id" value={id} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg border border-error/40 px-3 py-1.5 text-xs font-bold text-error hover:bg-error/5 disabled:opacity-60"
        title={`حذف ${name}`}
      >
        {pending ? "…" : "حذف"}
      </button>
      {state?.error ? (
        <span className="ms-2 text-xs font-medium text-error" role="alert">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
