"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, X } from "lucide-react";
import { rejectBookingRequestAction } from "@/app/admin/booking-request-actions";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  bookingRequestId: number;
  customerName?: string | null;
  carModelLabel?: string | null;
  onSuccess?: () => void;
};

export function AdminRejectBookingModal({
  isOpen,
  onClose,
  bookingRequestId,
  customerName,
  carModelLabel,
  onSuccess,
}: Props) {
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      setError("يرجى كتابة سبب رفض الطلب.");
      return;
    }

    setError(null);
    startTransition(async () => {
      const res = await rejectBookingRequestAction(bookingRequestId, reason.trim());
      if (!res.ok) {
        setError(res.error || "تعذّر رفض الطلب.");
        return;
      }
      setReason("");
      onClose();
      if (onSuccess) {
        onSuccess();
      } else {
        router.refresh();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-outline-variant/30 pb-3">
          <h3 className="flex items-center gap-2 text-base font-extrabold text-error">
            <X className="size-5 text-red-600" />
            رفض طلب الحجز #{bookingRequestId}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 font-bold text-lg cursor-pointer"
          >
            ✕
          </button>
        </div>

        {customerName || carModelLabel ? (
          <div className="rounded-xl border border-outline-variant/30 bg-surface-container-low p-3 text-xs space-y-1 text-on-surface-variant">
            {customerName ? (
              <p>
                العميل: <span className="font-bold text-on-surface">{customerName}</span>
              </p>
            ) : null}
            {carModelLabel ? (
              <p>
                المركبة: <span className="font-bold text-on-surface">{carModelLabel}</span>
              </p>
            ) : null}
          </div>
        ) : null}

        {error ? (
          <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-xs font-bold text-red-700">
            <AlertCircle className="size-4 shrink-0" />
            {error}
          </div>
        ) : null}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-extrabold text-on-surface mb-1.5">
              سبب رفض الطلب <span className="text-red-600">*</span>:
            </label>
            <textarea
              rows={3}
              required
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="يرجى كتابة سبب رفض الطلب (مثال: عدم توفر السيارة في الموعد المطلوبة، عدم استيفاء شروط التأجير...)"
              className="w-full rounded-xl border border-outline-variant bg-surface-container-lowest p-3 text-sm font-semibold text-on-surface outline-none focus:ring-2 focus:ring-error"
            />
            <p className="mt-1 text-[11px] text-on-surface-variant font-medium">
              سيتم حفظ هذا السبب كحقل مخصص لرفض الطلب (`rejectionReasonAr`) وتوثيقه في سجل الحجز.
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-outline-variant/20">
            <button
              type="button"
              disabled={pending}
              onClick={onClose}
              className="rounded-xl border border-outline-variant bg-white px-4 py-2 text-xs font-bold text-on-surface-variant hover:bg-surface-container cursor-pointer disabled:opacity-50"
            >
              إلغاء
            </button>
            <button
              type="submit"
              disabled={pending || !reason.trim()}
              className="inline-flex items-center gap-1.5 rounded-xl bg-error px-5 py-2 text-xs font-extrabold text-white hover:opacity-90 disabled:opacity-50 cursor-pointer shadow-2xs"
            >
              {pending ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  جاري الرفض...
                </>
              ) : (
                "تأكيد الرفض"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
