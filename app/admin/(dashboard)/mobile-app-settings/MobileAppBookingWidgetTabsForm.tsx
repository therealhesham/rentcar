"use client";

import { useActionState } from "react";
import { updateMobileAppBookingWidgetTabs } from "@/app/admin/mobile-app-settings-actions";
import type {
  MobileAppBookingWidgetFlags,
  MobileAppBookingWidgetPeriod,
  MobileAppBookingWidgetMode,
} from "@/lib/mobile-app-booking-widget-flags";

type Props = {
  flags: MobileAppBookingWidgetFlags;
};

const PERIOD_FIELDS: { key: MobileAppBookingWidgetPeriod; label: string }[] = [
  { key: "rentalDaily", label: "يومي" },
  { key: "rentalWeekly", label: "أسبوعي" },
  { key: "rentalMonthly", label: "شهري" },
  { key: "rentalMonthlyPackages", label: "الباقات الشهرية" },
];

const MODE_FIELDS: { key: MobileAppBookingWidgetMode; label: string }[] = [
  { key: "modePickup", label: "استلام من فرع" },
  { key: "modeDelivery", label: "توصيل لموقع العميل" },
];

export function MobileAppBookingWidgetTabsForm({ flags }: Props) {
  const [state, formAction, pending] = useActionState(updateMobileAppBookingWidgetTabs, null);

  return (
    <form
      action={formAction}
      className="max-w-2xl space-y-6 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6"
    >
      <p className="text-sm leading-relaxed text-on-surface-variant">
        العناصر غير المفعّلة{" "}
        <span className="font-bold text-on-surface">لا تظهر في ودجت البحث بالشاشة الرئيسية لتطبيق روائس</span>{" "}
        — لا تأثير على ودجت البحث في الموقع.
      </p>

      <div>
        <h3 className="mb-2 text-sm font-bold text-on-surface">تابات مدة الإيجار</h3>
        <ul className="space-y-2">
          {PERIOD_FIELDS.map(({ key, label }) => (
            <li key={key}>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-3 hover:border-outline-variant">
                <input
                  type="checkbox"
                  name={key}
                  defaultChecked={flags[key]}
                  className="size-4 accent-primary"
                />
                <span className="font-bold text-on-surface">{label}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-bold text-on-surface">وضع الاستلام</h3>
        <ul className="space-y-2">
          {MODE_FIELDS.map(({ key, label }) => (
            <li key={key}>
              <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-3 hover:border-outline-variant">
                <input
                  type="checkbox"
                  name={key}
                  defaultChecked={flags[key]}
                  className="size-4 accent-primary"
                />
                <span className="font-bold text-on-surface">{label}</span>
              </label>
            </li>
          ))}
        </ul>
      </div>

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
