"use client";

import { useActionState } from "react";
import {
  refundGeideaTestPaymentAction,
  type RefundActionState,
} from "@/app/admin/test-geidea-actions";

type Props = {
  orderId: string;
  amountSar: number;
};

export function TestGeideaRefundForm({ orderId, amountSar }: Props) {
  const [state, formAction, pending] = useActionState<RefundActionState | null, FormData>(
    refundGeideaTestPaymentAction,
    null,
  );

  return (
    <form action={formAction} className="mt-4 flex flex-col items-start gap-3">
      <input type="hidden" name="orderId" value={orderId} />
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
          <p>حالة الطلب بعد الاسترداد: {state.orderStatus}</p>
          <p dir="ltr">مرجع عملية الاسترداد: {state.refundTransactionRef}</p>
        </div>
      ) : null}
    </form>
  );
}
