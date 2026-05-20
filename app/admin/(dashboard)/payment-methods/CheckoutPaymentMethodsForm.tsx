"use client";

import { useActionState } from "react";
import { updateCheckoutPaymentMethods } from "@/app/admin/payment-methods-actions";
import type {
  CheckoutPaymentMethodFlags,
  CustomerCheckoutPaymentMethod,
} from "@/lib/checkout-payment-method-flags";

type Props = {
  flags: CheckoutPaymentMethodFlags;
};

const METHOD_FIELDS: {
  key: CustomerCheckoutPaymentMethod;
  label: string;
  hint: string;
}[] = [
  {
    key: "TABBY",
    label: "تابي",
    hint: "تقسيط على دفعات — يظهر بشعار تابي في صفحة الدفع.",
  },
  {
    key: "TAMARA",
    label: "تمارا",
    hint: "تقسيط تمارا — يظهر بشعار تمارا.",
  },
  {
    key: "CARD",
    label: "بطاقة ائتمانية",
    hint: "مدى / فيزا / ماستركارد مع نموذج بيانات البطاقة.",
  },
  {
    key: "CASH",
    label: "نقدي (كاش)",
    hint: "الدفع نقداً عند الاستلام أو في الفرع — يُسجَّل الطلب كمدفوع للاختبار.",
  },
  {
    key: "APPLE_PAY",
    label: "Apple Pay",
    hint: "دفع سريع من محفظة آبل.",
  },
  {
    key: "POINTS",
    label: "استبدال نقاط",
    hint: "خصم من برنامج الولاء (تجريبي حتى ربط النظام).",
  },
];

export function CheckoutPaymentMethodsForm({ flags }: Props) {
  const [state, formAction, pending] = useActionState(updateCheckoutPaymentMethods, null);

  return (
    <form
      action={formAction}
      className="max-w-2xl space-y-6 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6"
    >
      <p className="text-sm leading-relaxed text-on-surface-variant">
        الطرق غير المفعّلة لا تظهر للعميل في{" "}
        <span className="font-bold text-on-surface">/fleet/payment</span>.
      </p>

      <ul className="space-y-2">
        {METHOD_FIELDS.map(({ key, label, hint }) => (
          <li key={key}>
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-3 hover:border-outline-variant">
              <input
                type="checkbox"
                name={key}
                defaultChecked={flags[key]}
                className="mt-0.5 size-4 accent-primary"
              />
              <span>
                <span className="block font-bold text-on-surface">{label}</span>
                <span className="mt-0.5 block font-mono text-[10px] text-on-surface-variant" dir="ltr">
                  {key}
                </span>
                <span className="mt-0.5 block text-xs text-on-surface-variant">{hint}</span>
              </span>
            </label>
          </li>
        ))}
      </ul>

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
