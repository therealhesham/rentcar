"use client";

import { useState, useTransition } from "react";
import { Check, Loader2, Mail } from "lucide-react";
import { sendDroppedBookingNotificationAction } from "@/app/admin/booking-notification-drops-actions";

/** زر إرسال يدوي لإشعار الموظفين على حجز لسه ما اترسلش له الإشعار خلال آخر ٢٤ ساعة. */
export function SendDroppedBookingNotificationButton({ bookingId }: { bookingId: number }) {
  const [isPending, startTransition] = useTransition();
  const [result, setResult] = useState<{ ok: boolean; error?: string } | null>(null);

  const run = () => {
    setResult(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.set("bookingId", String(bookingId));
      const res = await sendDroppedBookingNotificationAction(null, fd);
      setResult(res);
    });
  };

  if (isPending) {
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-on-surface-variant">
        <Loader2 className="size-4 animate-spin" /> جارٍ الإرسال...
      </span>
    );
  }

  if (result?.ok) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-100 px-3 py-1.5 text-xs font-bold text-emerald-800">
        <Check className="size-4" /> تم الإرسال
      </span>
    );
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={run}
        className="inline-flex items-center gap-1.5 rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-bold text-primary transition-colors hover:bg-surface-container"
      >
        <Mail className="size-4" /> إرسال الإشعار الآن
      </button>
      {result?.error ? (
        <span className="max-w-[220px] text-end text-[10px] font-bold text-error">
          {result.error}
        </span>
      ) : null}
    </span>
  );
}
