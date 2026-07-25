"use client";

import { useActionState } from "react";
import { Trash2 } from "lucide-react";
import { deleteBrand } from "@/app/admin/brand-actions";

type Props = {
  id: number;
  name: string;
  modelCount: number;
};

export function BrandDeleteForm({ id, name, modelCount }: Props) {
  const [state, formAction, pending] = useActionState(deleteBrand, null);

  const disabled = modelCount > 0 || pending;

  return (
    <form action={formAction} className="inline">
      <input type="hidden" name="id" value={id} />
      {state && !state.ok && state.error && (
        <span className="me-2 text-xs font-bold text-red-600">{state.error}</span>
      )}
      <button
        type="submit"
        disabled={disabled}
        onClick={(e) => {
          if (!confirm(`هل أنت تأكد من حذف براند "${name}"؟`)) {
            e.preventDefault();
          }
        }}
        title={
          modelCount > 0
            ? "لا يمكن حذف البراند لأنه مرتبط بسيارات"
            : "حذف البراند"
        }
        className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-red-50/50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-40"
      >
        <Trash2 className="h-3.5 w-3.5" />
        {pending ? "جاري الحذف..." : "حذف"}
      </button>
    </form>
  );
}
