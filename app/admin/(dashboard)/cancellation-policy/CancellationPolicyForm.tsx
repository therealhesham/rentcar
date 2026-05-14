"use client";

import { useActionState, useEffect, useId } from "react";
import { useRouter } from "next/navigation";
import {
  updateCustomerCancellationPolicy,
  type CancellationPolicyFormState,
} from "@/app/admin/cancellation-policy-actions";

type Props = {
  policyAr: string;
  minHoursBeforePickup: number;
};

export function CancellationPolicyForm({ policyAr, minHoursBeforePickup }: Props) {
  const uid = useId();
  const router = useRouter();
  const [state, formAction, pending] = useActionState(
    updateCustomerCancellationPolicy,
    null as CancellationPolicyFormState,
  );

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
    }
  }, [state?.ok, router]);

  return (
    <form action={formAction} className="max-w-3xl space-y-8">
      <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-sm">
        <label htmlFor={`${uid}-hours`} className="block text-sm font-bold text-on-surface">
          مهلة الإلغاء الذاتي (بالساعات قبل موعد الاستلام)
        </label>
        <p className="mt-1 text-sm text-on-surface-variant">
          إذا وضعت مثلاً «٢»، لا يستطيع العميل إلغاء الحجز من حسابه إلا قبل موعد الاستلام بأكثر من
          ساعتين. القيمة «٠» تعني عدم تطبيق أي تقييد زمني من الموقع.
        </p>
        <input
          id={`${uid}-hours`}
          name="minHoursBeforePickup"
          type="number"
          min={0}
          max={720}
          step={1}
          defaultValue={minHoursBeforePickup}
          className="mt-3 w-full max-w-xs rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm font-semibold tabular-nums outline-none focus:ring-2 focus:ring-primary"
          dir="ltr"
        />
      </div>

      <div className="rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 shadow-sm">
        <label htmlFor={`${uid}-policy`} className="block text-sm font-bold text-on-surface">
          نص سياسات الإلغاء للعميل
        </label>
        <p className="mt-1 text-sm text-on-surface-variant">
          يُعرض في نافذة تأكيد «إزالة الحجز» في صفحة حساب العميل (اختياري).
        </p>
        <textarea
          id={`${uid}-policy`}
          name="policyAr"
          rows={8}
          defaultValue={policyAr}
          maxLength={8000}
          className="mt-3 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-3 text-sm leading-relaxed outline-none focus:ring-2 focus:ring-primary"
          placeholder="مثال: يمكن الإلغاء مجاناً قبل موعد الاستلام بـ ٢٤ ساعة…"
        />
      </div>

      {state?.ok ? (
        <p className="text-sm font-bold text-emerald-800" role="status">
          تم حفظ الإعدادات.
        </p>
      ) : null}
      {state?.ok === false && state.error ? (
        <p className="text-sm font-bold text-red-700" role="alert">
          {state.error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-primary px-6 py-3 text-sm font-extrabold text-on-primary shadow-sm transition-opacity hover:opacity-95 disabled:opacity-60"
      >
        {pending ? "جاري الحفظ…" : "حفظ"}
      </button>
    </form>
  );
}
