"use client";

import { useActionState } from "react";
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import {
  captureTabbyTestPaymentAction,
  type TabbyTestActionState,
} from "@/app/admin/test-tabby-actions";

type Props = {
  paymentId: string;
  amountSar: number;
};

export function TestTabbyCaptureForm({ paymentId, amountSar }: Props) {
  const router = useRouter();
  const [state, formAction, pending] = useActionState<TabbyTestActionState | null, FormData>(
    captureTabbyTestPaymentAction,
    null,
  );

  useEffect(() => {
    if (state?.ok) router.refresh();
  }, [state?.ok, router]);

  return (
    <form action={formAction} className="flex flex-col items-start gap-3">
      <input type="hidden" name="paymentId" value={paymentId} />
      <input type="hidden" name="amountSar" value={amountSar} />
      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-primary px-5 py-2.5 text-sm font-extrabold text-on-primary transition-opacity hover:opacity-95 disabled:opacity-50"
      >
        {pending ? "جاري تنفيذ التحصيل…" : "تنفيذ التحصيل (Capture)"}
      </button>
      {state && !state.ok ? (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
          {state.error}
        </p>
      ) : null}
    </form>
  );
}
