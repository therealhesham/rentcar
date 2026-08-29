"use client";

import { useActionState } from "react";
import {
  refundTabbyTestPaymentAction,
  type TabbyTestActionState,
} from "@/app/admin/test-tabby-actions";

type Props = {
  paymentId: string;
  amountSar: number;
};

export function TestTabbyRefundForm({ paymentId, amountSar }: Props) {
  const [state, formAction, pending] = useActionState<TabbyTestActionState | null, FormData>(
    refundTabbyTestPaymentAction,
    null,
  );

  return (
    <form action={formAction} className="mt-4 flex flex-col items-start gap-3">
      <input type="hidden" name="paymentId" value={paymentId} />
      <input type="hidden" name="amountSar" value={amountSar} />
      <button
        type="submit"
        disabled={pending || state?.ok}
        className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-extrabold text-white transition-opacity hover:opacity-95 disabled:opacity-50"
      >
        {pending ? "جاري تنفيذ الاسترداد…" : state?.ok ? "تم الاسترداد ✓" : "تنفيذ استرداد الآن"}
      </button>
      {state && !state.ok ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <div className="rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">
          <p>حالة الدفعة بعد الاسترداد: {state.status}</p>
          <p dir="ltr">مرجع عملية الاسترداد: {state.refundId}</p>
        </div>
      ) : null}
    </form>
  );
}
