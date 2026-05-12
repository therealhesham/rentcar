"use client";

import { useActionState } from "react";
import {
  deleteInterCityShippingFee,
  setInterCityShippingFeeActive,
  type ActionState,
} from "@/app/admin/inter-city-shipping-actions";

export function InterCityShippingFeeRow({
  row,
}: {
  row: {
    id: number;
    feeExclVatSar: number;
    isActive: boolean;
    fromCity: { slug: string; name: string };
    toCity: { slug: string; name: string };
  };
}) {
  const [delState, delAction, delPending] = useActionState(deleteInterCityShippingFee, null as ActionState);
  const [actState, actAction, actPending] = useActionState(setInterCityShippingFeeActive, null as ActionState);

  return (
    <tr className="border-b border-outline-variant/20 last:border-0">
      <td className="px-4 py-3 text-sm font-semibold">{row.fromCity.name}</td>
      <td className="px-4 py-3 font-mono text-xs text-on-surface-variant" dir="ltr">
        {row.fromCity.slug}
      </td>
      <td className="px-4 py-3 text-sm font-semibold">{row.toCity.name}</td>
      <td className="px-4 py-3 font-mono text-xs text-on-surface-variant" dir="ltr">
        {row.toCity.slug}
      </td>
      <td className="px-4 py-3 text-end font-mono text-sm font-bold" dir="ltr">
        {row.feeExclVatSar}
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
            if (!confirm("حذف هذا المسار؟")) e.preventDefault();
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
