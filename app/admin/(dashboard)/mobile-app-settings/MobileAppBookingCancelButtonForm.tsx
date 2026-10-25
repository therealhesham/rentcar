"use client";

import { useActionState } from "react";
import { updateMobileAppBookingCancelButton } from "@/app/admin/mobile-app-settings-actions";
import type { MobileAppBookingCancelFlag } from "@/lib/mobile-app-booking-cancel-flag";

type Props = {
  flag: MobileAppBookingCancelFlag;
};

export function MobileAppBookingCancelButtonForm({ flag }: Props) {
  const [state, formAction, pending] = useActionState(updateMobileAppBookingCancelButton, null);

  return (
    <form
      action={formAction}
      className="max-w-2xl space-y-6 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6"
    >
      <div>
        <h3 className="mb-2 text-sm font-bold text-on-surface">زرار إلغاء الحجز</h3>
        <p className="mb-3 text-sm leading-relaxed text-on-surface-variant">
          عند التعطيل، <span className="font-bold text-on-surface">لا يظهر زرار "إلغاء الحجز" في شاشة تفاصيل الحجز بتطبيق روائس</span>{" "}
          — العميل يقدر يطلب الإلغاء من خلالكم مباشرة. لا تأثير على إلغاء الحجز من لوحة الإدارة.
        </p>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-3 hover:border-outline-variant">
          <input type="checkbox" name="enabled" defaultChecked={flag.enabled} className="size-4 accent-primary" />
          <span className="font-bold text-on-surface">إظهار زرار إلغاء الحجز للعميل</span>
        </label>
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
