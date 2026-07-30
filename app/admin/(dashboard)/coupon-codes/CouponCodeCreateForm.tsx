"use client";

import { useActionState, useEffect, useRef } from "react";
import { createCouponCode, type ActionState } from "@/app/admin/coupon-code-actions";
import { CouponCodeFields } from "@/app/admin/(dashboard)/coupon-codes/CouponCodeFields";

export function CouponCodeCreateForm() {
  const [state, formAction, pending] = useActionState(createCouponCode, null as ActionState | null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state?.ok]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="mb-10 grid gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 md:grid-cols-2"
    >
      <h2 className="text-lg font-extrabold tracking-tight md:col-span-2">إضافة كود خصم</h2>

      <CouponCodeFields />

      {state?.error ? (
        <p className="text-sm font-bold text-error md:col-span-2">{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p className="text-sm font-bold text-primary md:col-span-2">تم حفظ الكود.</p>
      ) : null}

      <div className="md:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="gradient-cta rounded-xl px-6 py-3 text-sm font-extrabold text-white disabled:opacity-60"
        >
          {pending ? "جاري الحفظ…" : "إضافة الكود"}
        </button>
      </div>
    </form>
  );
}
