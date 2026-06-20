"use client";

import { useState, useTransition } from "react";
import { useActionState } from "react";
import { processBookingRefund } from "@/app/admin/booking-finance-actions";
import { AlertCircle, CheckCircle2, Loader2, ArrowLeftRight } from "lucide-react";

export function BookingFinanceOperationsPanel({
  bookingId,
  paymentStatus,
  currentRefundAmount = 0
}: {
  bookingId: number;
  paymentStatus: string;
  currentRefundAmount?: number;
}) {
  const [isPartial, setIsPartial] = useState(false);
  const [state, formAction, isPending] = useActionState(processBookingRefund, null);

  const statusKey = paymentStatus.trim().toUpperCase();

  return (
    <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-sm">
      <h3 className="mb-4 text-lg font-bold text-on-surface">إجراء استرداد مالي (Refund)</h3>

      {statusKey === "PENDING" ? (
        <div className="flex items-center gap-2 rounded-xl bg-amber-50 p-4 text-sm font-semibold text-amber-900 border border-amber-200">
          <AlertCircle className="h-5 w-5" />
          <span>لا يمكن إجراء استرداد مالي لأن الحجز غير مدفوع (قيد الدفع).</span>
        </div>
      ) : statusKey === "REFUNDED" ? (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-4 text-sm font-semibold text-emerald-900 border border-emerald-200">
          <CheckCircle2 className="h-5 w-5" />
          <span>هذا الحجز مسترد بالكامل. لا يمكن إجراء استرداد إضافي.</span>
        </div>
      ) : (
        <form action={formAction} className="space-y-5">
          <input type="hidden" name="bookingId" value={bookingId} />
          <input type="hidden" name="isPartial" value={isPartial.toString()} />

          {state?.error ? (
            <div className="flex items-center gap-2 rounded-xl bg-error-container/50 p-3 text-sm font-semibold text-error">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{state.error}</span>
            </div>
          ) : null}

          {state?.ok ? (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>تمت عملية الاسترداد بنجاح.</span>
            </div>
          ) : null}

          <div>
            <label className="mb-1.5 block text-sm font-bold text-on-surface">
              نوع الاسترداد
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={() => setIsPartial(false)}
                className={`rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors ${
                  !isPartial
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low"
                }`}
              >
                استرداد كامل (Full Refund)
              </button>
              <button
                type="button"
                onClick={() => setIsPartial(true)}
                className={`rounded-xl border px-4 py-2.5 text-sm font-bold transition-colors ${
                  isPartial
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-outline-variant/40 bg-surface-container-lowest text-on-surface-variant hover:bg-surface-container-low"
                }`}
              >
                استرداد جزئي (Partial Refund)
              </button>
            </div>
          </div>

          <div>
            <label htmlFor="amount" className="mb-1.5 block text-sm font-bold text-on-surface">
              المبلغ المسترد (ر.س)
            </label>
            <input
              type="number"
              id="amount"
              name="amount"
              required
              step="0.01"
              min="0.01"
              className="w-full rounded-xl border-outline-variant/40 bg-surface-container-lowest px-4 py-2.5 text-sm font-medium text-on-surface outline-none ring-primary/50 transition-all focus:border-primary focus:ring-2"
              placeholder="مثال: 150.00"
            />
          </div>

          <div>
            <label htmlFor="externalRef" className="mb-1.5 block text-sm font-bold text-on-surface">
              الرقم المرجعي للعملية (اختياري)
            </label>
            <input
              type="text"
              id="externalRef"
              name="externalRef"
              className="w-full rounded-xl border-outline-variant/40 bg-surface-container-lowest px-4 py-2.5 text-sm font-medium text-on-surface outline-none ring-primary/50 transition-all focus:border-primary focus:ring-2"
              placeholder="مثال: REF-123456"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary transition-opacity hover:opacity-95 disabled:opacity-70"
          >
            {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowLeftRight className="h-5 w-5" />}
            {isPending ? "جاري المعالجة..." : "تنفيذ الاسترداد"}
          </button>
        </form>
      )}
    </div>
  );
}
