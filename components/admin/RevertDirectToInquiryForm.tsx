"use client";

import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useId, useState } from "react";
import { revertDirectToInquiry } from "@/app/admin/booking-request-actions";

type Props = {
  bookingRequestId: number;
};

type InnerProps = {
  bookingRequestId: number;
  onClose: () => void;
};

function RevertDirectModalInner({ bookingRequestId, onClose }: InnerProps) {
  const router = useRouter();
  const titleId = useId();
  const [state, formAction, pending] = useActionState(revertDirectToInquiry, null);

  useEffect(() => {
    if (state?.ok) {
      router.refresh();
      onClose();
    }
  }, [state?.ok, router, onClose]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !pending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [pending, onClose]);

  return (
    <>
      <button
        type="button"
        aria-label="إغلاق"
        disabled={pending}
        className="absolute inset-0 bg-inverse-surface/50 backdrop-blur-sm disabled:cursor-not-allowed"
        onClick={() => {
          if (!pending) onClose();
        }}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative z-10 w-full max-w-md rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-6 editorial-shadow"
      >
        <div className="flex items-start justify-between gap-3 border-b border-outline-variant/30 pb-4">
          <h2 id={titleId} className="text-lg font-extrabold tracking-tight">
            إرجاع إلى طلب استفسار
          </h2>
          <button
            type="button"
            disabled={pending}
            onClick={() => onClose()}
            className="shrink-0 rounded-lg p-1.5 text-on-surface-variant hover:bg-surface-container disabled:opacity-50"
            aria-label="إغلاق"
          >
            <X className="h-5 w-5" aria-hidden />
          </button>
        </div>

        <form action={formAction} className="mt-4 flex flex-col gap-4">
          <input type="hidden" name="bookingRequestId" value={bookingRequestId} />
          <p className="text-sm leading-relaxed text-on-surface-variant">
            يُلغى ربط السيارة المحددة من الأسطول (يُفرَّج الحجز في هذه الفترة)، ويُعاد السجل إلى{" "}
            <strong className="text-on-surface">طلب حجز (استفسار)</strong> بحالة جديدة. بيانات العميل
            والتواريخ تبقى كما هي.
          </p>
          {state?.error ? (
            <p className="rounded-xl bg-error-container px-3 py-2 text-sm font-medium text-error" role="alert">
              {state.error}
            </p>
          ) : null}
          <div className="flex flex-wrap items-center justify-end gap-2 border-t border-outline-variant/30 pt-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => onClose()}
              className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface-container disabled:opacity-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={pending}
              className="rounded-xl border border-error/40 bg-error-container/50 px-5 py-2 text-sm font-bold text-error hover:bg-error-container disabled:opacity-60"
            >
              {pending ? "جاري الإرجاع…" : "تأكيد الإرجاع"}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

export function RevertDirectToInquiryForm({ bookingRequestId }: Props) {
  const [open, setOpen] = useState(false);
  const [innerKey, setInnerKey] = useState(0);

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setInnerKey((k) => k + 1);
          setOpen(true);
        }}
        className="rounded-lg border border-outline-variant bg-surface-container px-3 py-1.5 text-xs font-bold text-on-surface hover:bg-surface-container-high"
      >
        إرجاع لطلب استفسار
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="presentation"
        >
          <RevertDirectModalInner
            key={innerKey}
            bookingRequestId={bookingRequestId}
            onClose={() => setOpen(false)}
          />
        </div>
      ) : null}
    </>
  );
}
