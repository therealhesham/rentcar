"use client";

import { useActionState } from "react";
import {
  deleteCheckoutOneTimeFee,
  setCheckoutOneTimeFeeActive,
  updateCheckoutOneTimeFee,
  type ActionState,
} from "@/app/admin/checkout-fee-actions";

export function CheckoutFeeRow({
  row,
}: {
  row: {
    id: number;
    slug: string;
    labelAr: string;
    labelEn: string | null;
    feeExclVatSar: number;
    isActive: boolean;
    sortOrder: number;
  };
}) {
  const [updState, updAction, updPending] = useActionState(updateCheckoutOneTimeFee, null as ActionState);
  const [delState, delAction, delPending] = useActionState(deleteCheckoutOneTimeFee, null as ActionState);
  const [actState, actAction, actPending] = useActionState(setCheckoutOneTimeFeeActive, null as ActionState);

  return (
    <tr className="border-b border-outline-variant/20 last:border-0">
      <td className="px-4 py-3 font-mono text-xs text-on-surface-variant" dir="ltr">
        {row.slug}
      </td>
      <td className="px-4 py-3">
        <form action={updAction} className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-end">
          <input type="hidden" name="id" value={row.id} />
          <label className="block min-w-[180px] flex-1 text-xs font-medium text-on-surface-variant">
            الاسم (عربي)
            <input
              name="labelAr"
              type="text"
              required
              minLength={2}
              maxLength={255}
              defaultValue={row.labelAr}
              className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface outline-none ring-primary/20 focus:ring-2"
            />
          </label>
          <label className="block min-w-[180px] flex-1 text-xs font-medium text-on-surface-variant">
            الاسم (إنجليزي)
            <input
              name="labelEn"
              type="text"
              defaultValue={row.labelEn ?? ""}
              className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-sm text-on-surface outline-none ring-primary/20 focus:ring-2"
            />
          </label>
          <label className="block w-28 text-xs font-medium text-on-surface-variant">
            ريال (دون ضريبة)
            <input
              name="feeExclVatSar"
              type="number"
              min={0}
              max={500000}
              step={1}
              required
              defaultValue={row.feeExclVatSar}
              className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1.5 font-mono text-sm outline-none ring-primary/20 focus:ring-2"
              dir="ltr"
            />
          </label>
          <label className="block w-20 text-xs font-medium text-on-surface-variant">
            ترتيب
            <input
              name="sortOrder"
              type="number"
              defaultValue={row.sortOrder}
              className="mt-1 w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1.5 font-mono text-sm outline-none ring-primary/20 focus:ring-2"
              dir="ltr"
            />
          </label>
          <button
            type="submit"
            disabled={updPending}
            className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-bold hover:bg-surface-container disabled:opacity-50"
          >
            {updPending ? "…" : "تحديث"}
          </button>
        </form>
        {updState?.error ? (
          <p className="mt-1 text-xs text-error">{updState.error}</p>
        ) : updState?.ok ? (
          <p className="mt-1 text-xs font-bold text-primary">تم التحديث.</p>
        ) : null}
      </td>
      <td className="px-4 py-3">
        <form action={actAction} className="inline">
          <input type="hidden" name="id" value={row.id} />
          <input type="hidden" name="isActive" value={row.isActive ? "false" : "true"} />
          <button
            type="submit"
            disabled={actPending}
            className="rounded-lg border border-outline-variant px-2 py-1 text-xs font-bold hover:bg-surface-container disabled:opacity-50"
          >
            {row.isActive ? "تعطيل" : "تفعيل"}
          </button>
        </form>
        {actState?.error ? (
          <span className="ms-2 text-xs text-error">{actState.error}</span>
        ) : null}
      </td>
      <td className="px-4 py-3">
        <form
          action={delAction}
          className="inline"
          onSubmit={(e) => {
            if (!confirm("حذف هذه الرسوم؟")) e.preventDefault();
          }}
        >
          <input type="hidden" name="id" value={row.id} />
          <button
            type="submit"
            disabled={delPending}
            className="rounded-lg border border-error/40 px-2 py-1 text-xs font-bold text-error hover:bg-error/10 disabled:opacity-50"
          >
            حذف
          </button>
        </form>
        {delState?.error ? (
          <span className="ms-2 text-xs text-error">{delState.error}</span>
        ) : null}
      </td>
    </tr>
  );
}
