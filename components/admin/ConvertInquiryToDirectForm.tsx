"use client";

import { useActionState } from "react";
import { convertInquiryToDirect } from "@/app/admin/booking-request-actions";

export type BookableModelOption = {
  id: number;
  label: string;
};

type Props = {
  bookingRequestId: number;
  models: BookableModelOption[];
};

export function ConvertInquiryToDirectForm({ bookingRequestId, models }: Props) {
  const [state, formAction, pending] = useActionState(convertInquiryToDirect, null);

  if (models.length === 0) {
    return (
      <p className="max-w-[14rem] text-xs text-on-surface-variant">
        لا توجد مركبات بكمية متاحة في الأسطول لربطها بالطلب.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex min-w-[220px] flex-col gap-2">
      <input type="hidden" name="bookingRequestId" value={bookingRequestId} />
      <select
        name="carModelId"
        required
        defaultValue=""
        className="w-full rounded-lg border border-outline-variant bg-surface-container-lowest px-2 py-1.5 text-xs text-on-surface outline-none focus:ring-2 focus:ring-primary"
      >
        <option value="" disabled>
          اختر السيارة…
        </option>
        {models.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        disabled={pending}
        className="rounded-lg bg-primary px-2 py-1.5 text-xs font-bold text-on-primary disabled:opacity-60"
      >
        {pending ? "…" : "تحويل لحجز مباشر"}
      </button>
      {state?.ok ? (
        <span className="text-xs font-bold text-primary" role="status">
          تم التحويل
        </span>
      ) : null}
      {state?.error ? (
        <span className="text-xs font-bold text-error" role="alert">
          {state.error}
        </span>
      ) : null}
    </form>
  );
}
