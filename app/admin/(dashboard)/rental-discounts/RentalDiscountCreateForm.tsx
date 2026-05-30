"use client";

import { useActionState, useEffect, useRef } from "react";
import { createRentalDiscount, type ActionState } from "@/app/admin/rental-discount-actions";
import {
  RentalDiscountFields,
  type BrandOpt,
  type BranchOpt,
  type ModelOpt,
} from "@/app/admin/(dashboard)/rental-discounts/RentalDiscountFields";

type Props = {
  brands: BrandOpt[];
  models: ModelOpt[];
  branches: BranchOpt[];
};

export function RentalDiscountCreateForm({ brands, models, branches }: Props) {
  const [state, formAction, pending] = useActionState(createRentalDiscount, null as ActionState | null);
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
      <h2 className="text-lg font-extrabold tracking-tight md:col-span-2">إضافة خصم</h2>
      <p className="text-sm text-on-surface-variant md:col-span-2">
        الاسم الداخلي يظهر للإدارة فقط. العميل يرى السعر بعد الخصم مع عبارة مختصرة (نسبة أو وفّرت X)
        دون معرفة الفترة أو الماركة أو الفرع.
      </p>

      <RentalDiscountFields brands={brands} models={models} branches={branches} />

      {state?.error ? (
        <p className="text-sm font-bold text-error md:col-span-2">{state.error}</p>
      ) : null}
      {state?.ok ? (
        <p className="text-sm font-bold text-primary md:col-span-2">تم حفظ الخصم.</p>
      ) : null}

      <div className="md:col-span-2">
        <button
          type="submit"
          disabled={pending}
          className="gradient-cta rounded-xl px-6 py-3 text-sm font-extrabold text-white disabled:opacity-60"
        >
          {pending ? "جاري الحفظ…" : "إضافة الخصم"}
        </button>
      </div>
    </form>
  );
}
