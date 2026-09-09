"use client";

import { useActionState } from "react";
import { updateMobileAppPaymentMethods } from "@/app/admin/mobile-app-settings-actions";
import type {
  MobileAppPaymentMethodFlags,
  MobileAppPaymentMethod,
} from "@/lib/mobile-app-payment-flags";

type Props = {
  flags: MobileAppPaymentMethodFlags;
};

const METHOD_FIELDS: {
  key: MobileAppPaymentMethod;
  label: string;
  hint: string;
}[] = [
  {
    key: "TABBY",
    label: "تابي",
    hint: "تقسيط على دفعات — يظهر بشعار تابي في التطبيق.",
  },
  {
    key: "TAMARA",
    label: "تمارا",
    hint: "تقسيط تمارا — يظهر بشعار تمارا.",
  },
  {
    key: "CARD",
    label: "بطاقة ائتمانية",
    hint: "فيزا / ماستركارد.",
  },
  {
    key: "MADA",
    label: "مدى",
    hint: "الدفع ببطاقة مدى.",
  },
  {
    key: "AMKAN",
    label: "إمكان",
    hint: "خدمة إمكان — يظهر كخيار دفع منفصل.",
  },
  {
    key: "CASH",
    label: "عند الفرع",
    hint: "يدفع العميل عند الاستلام في الفرع.",
  },
  {
    key: "APPLE_PAY",
    label: "Apple Pay",
    hint: "دفع سريع من محفظة آبل.",
  },
  {
    key: "POINTS",
    label: "استبدال نقاط",
    hint: "خصم من برنامج الولاء.",
  },
];

export function MobileAppPaymentMethodsForm({ flags }: Props) {
  const [state, formAction, pending] = useActionState(updateMobileAppPaymentMethods, null);

  return (
    <form
      action={formAction}
      className="max-w-2xl space-y-6 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6"
    >
      <p className="text-sm leading-relaxed text-on-surface-variant">
        الطرق غير المفعّلة{" "}
        <span className="font-bold text-on-surface">لا تظهر للعميل في تطبيق روائس</span>{" "}
        — لا تأثير على طرق دفع الموقع.
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
                <span
                  className="mt-0.5 block font-mono text-[10px] text-on-surface-variant"
                  dir="ltr"
                >
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
          تم حفظ إعدادات التطبيق.
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
