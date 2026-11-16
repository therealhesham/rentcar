"use client";

import { useActionState, useEffect, useRef } from "react";
import { createDeliveryDriver } from "@/app/admin/delivery-driver-actions";

const inputClass =
  "mt-2 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-4 py-2.5 text-on-surface outline-none ring-primary/30 focus:ring-2";

export function DeliveryDriverCreateForm() {
  const [state, formAction, pending] = useActionState(createDeliveryDriver, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form
      ref={formRef}
      action={formAction}
      className="mb-10 grid gap-4 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6"
    >
      <h2 className="text-lg font-extrabold tracking-tight">إضافة سواق</h2>
      <p className="text-sm text-on-surface-variant">
        السواق يسجّل دخول تطبيق التوصيل برقم الجوال وكلمة المرور المحددة هنا.
      </p>

      <div className="grid gap-4 sm:grid-cols-3">
        <label className="text-sm font-medium">
          الاسم
          <input name="name" required className={inputClass} />
        </label>
        <label className="text-sm font-medium">
          رقم الجوال
          <input
            name="phone"
            required
            dir="ltr"
            inputMode="tel"
            placeholder="05XXXXXXXX"
            className={inputClass}
          />
        </label>
        <label className="text-sm font-medium">
          كلمة المرور
          <input
            name="password"
            type="password"
            required
            minLength={6}
            autoComplete="new-password"
            className={inputClass}
          />
        </label>
      </div>

      {state?.error ? <p className="text-sm font-bold text-error">{state.error}</p> : null}
      {state?.ok ? <p className="text-sm font-bold text-primary">تمت إضافة السواق.</p> : null}

      <button
        type="submit"
        disabled={pending}
        className="justify-self-start rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary disabled:opacity-60"
      >
        {pending ? "جاري الحفظ…" : "إضافة السواق"}
      </button>
    </form>
  );
}
