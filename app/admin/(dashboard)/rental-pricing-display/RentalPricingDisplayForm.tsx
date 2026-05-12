"use client";

import { useActionState } from "react";
import { updateRentalPriceDisplay } from "@/app/admin/rental-pricing-display-actions";
import type { RentalPriceDisplayMode } from "@/lib/pricing";

type Props = {
  currentMode: RentalPriceDisplayMode;
};

const OPTIONS: { value: RentalPriceDisplayMode; title: string; hint: string }[] = [
  {
    value: "EX_TAX",
    title: "السعر بدون ضريبة (كما هو مخزَّن)",
    hint: "يظهر للعميل السعر اليومي دون ضريبة، مع تذييل أن الأسعار غير شاملة للضريبة.",
  },
  {
    value: "INCLUSIVE",
    title: "السعر الكلي شاملاً الضريبة",
    hint: "يظهر للعميل المبلغ اليومي بعد إضافة ضريبة القيمة المضافة حسب نسبة كل موديل.",
  },
  {
    value: "SPLIT",
    title: "قبل الضريبة وبعدها",
    hint: "يظهر سعران: قبل الضريبة وبعدها (بنفس نسبة الموديل).",
  },
];

export function RentalPricingDisplayForm({ currentMode }: Props) {
  const [state, formAction, pending] = useActionState(updateRentalPriceDisplay, null);

  return (
    <form
      action={formAction}
      className="max-w-2xl space-y-6 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6"
    >
      <fieldset className="space-y-4">
        <legend className="text-base font-extrabold text-on-surface">طريقة العرض</legend>
        {OPTIONS.map((opt) => (
          <label
            key={opt.value}
            className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${
              currentMode === opt.value
                ? "border-primary bg-primary-container/20"
                : "border-outline-variant/40 bg-surface-container-lowest hover:border-outline-variant"
            }`}
          >
            <input
              type="radio"
              name="mode"
              value={opt.value}
              defaultChecked={currentMode === opt.value}
              className="mt-1 accent-primary"
            />
            <span>
              <span className="block font-bold text-on-surface">{opt.title}</span>
              <span className="mt-1 block text-sm text-on-surface-variant">{opt.hint}</span>
            </span>
          </label>
        ))}
      </fieldset>

      {state?.error ? (
        <p className="rounded-lg bg-error-container/30 px-3 py-2 text-sm font-bold text-error">
          {state.error}
        </p>
      ) : null}
      {state?.ok ? (
        <p className="rounded-lg bg-primary-container/30 px-3 py-2 text-sm font-bold text-on-primary-container">
          تم حفظ الإعداد.
        </p>
      ) : null}

      <button
        type="submit"
        disabled={pending}
        className="rounded-xl bg-primary px-6 py-2.5 text-sm font-bold text-on-primary transition-opacity disabled:opacity-60"
      >
        {pending ? "جاري الحفظ…" : "حفظ"}
      </button>
    </form>
  );
}
