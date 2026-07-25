"use client";

import { useState, useActionState } from "react";
import { processBookingRefund, reverseBookingRefund } from "@/app/admin/booking-finance-actions";
import { AlertCircle, CheckCircle2, Loader2, ArrowLeftRight, Undo2 } from "lucide-react";

export function BookingFinanceOperationsPanel({
  bookingId,
  paymentStatus,
  currentRefundAmount = 0,
  totalPaidAmountSar = null,
}: {
  bookingId: number;
  paymentStatus: string;
  currentRefundAmount?: number;
  totalPaidAmountSar?: number | null;
}) {
  const [isPartial, setIsPartial] = useState(false);
  const [state, formAction, isPending] = useActionState(processBookingRefund, null);
  const [revState, revAction, revPending] = useActionState(reverseBookingRefund, null);
  const [reverseAmount, setReverseAmount] = useState<string>(String(currentRefundAmount || ""));

  const statusKey = paymentStatus.trim().toUpperCase();

  // عند استرداد كامل، المبلغ يُحسب تلقائياً من المبلغ المدفوع مطروحاً منه ما سبق استرداده
  const remainingAmount =
    totalPaidAmountSar != null
      ? Math.max(0, totalPaidAmountSar - currentRefundAmount)
      : null;

  const autoAmount = !isPartial ? remainingAmount : null;

  // قيمة الـ input دائماً controlled — تتزامن مع autoAmount أو تُعدَّل يدوياً
  const [amountValue, setAmountValue] = useState<string>(
    autoAmount != null ? String(autoAmount) : ""
  );

  function handleIsPartialChange(partial: boolean) {
    setIsPartial(partial);
    if (!partial) {
      // Full refund: ملء تلقائي بالمبلغ المتبقي
      const remaining =
        totalPaidAmountSar != null
          ? Math.max(0, totalPaidAmountSar - currentRefundAmount)
          : null;
      setAmountValue(remaining != null ? String(remaining) : "");
    } else {
      // Partial: تفريغ الحقل ليكتب المستخدم
      setAmountValue("");
    }
  }

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
                onClick={() => handleIsPartialChange(false)}
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
                onClick={() => handleIsPartialChange(true)}
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
            <div className="relative">
              <input
                type="number"
                id="amount"
                name="amount"
                required
                step="0.01"
                min="0.01"
                readOnly={!isPartial && autoAmount != null}
                value={amountValue}
                onChange={(e) => setAmountValue(e.target.value)}
                className={`w-full rounded-xl border-outline-variant/40 bg-surface-container-lowest px-4 py-2.5 text-sm font-medium text-on-surface outline-none ring-primary/50 transition-all focus:border-primary focus:ring-2 ${
                  !isPartial && autoAmount != null
                    ? "bg-primary/5 border-primary/30 text-primary font-bold cursor-not-allowed"
                    : ""
                }`}
                placeholder={autoAmount == null ? "مثال: 150.00" : undefined}
              />
              {!isPartial && autoAmount != null && (
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-primary font-bold">
                  تلقائي
                </span>
              )}
            </div>
            {!isPartial && totalPaidAmountSar == null && (
              <p className="mt-1.5 text-xs text-on-surface-variant">
                المبلغ غير محفوظ للحجوزات القديمة — أدخله يدوياً.
              </p>
            )}
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

      {/* تصحيح استرداد خاطئ — يظهر متى وُجد استرداد مسجّل */}
      {currentRefundAmount > 0 ? (
        <form
          action={revAction}
          className="mt-5 space-y-3 rounded-xl border border-sky-200 bg-sky-50/60 p-4"
        >
          <input type="hidden" name="bookingId" value={bookingId} />
          <div className="flex items-center gap-2 text-sm font-bold text-sky-900">
            <Undo2 className="h-4 w-4" />
            تصحيح استرداد خاطئ
          </div>
          <p className="text-xs leading-relaxed text-sky-800">
            استردَّيت بالخطأ؟ اعكس المبلغ ليعود الحجز إلى حالته الصحيحة (مدفوع). يصحّح
            سجل النظام فقط — لا يعيد التحصيل من بطاقة العميل.
          </p>

          {revState?.error ? (
            <div className="flex items-center gap-2 rounded-lg bg-error-container/50 p-2.5 text-xs font-semibold text-error">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{revState.error}</span>
            </div>
          ) : null}
          {revState?.ok ? (
            <div className="flex items-center gap-2 rounded-lg bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-900">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>تم عكس الاسترداد بنجاح.</span>
            </div>
          ) : null}

          <div>
            <label htmlFor="reverseAmount" className="mb-1 block text-xs font-bold text-sky-900">
              مبلغ العكس (ر.س) — الأقصى {currentRefundAmount}
            </label>
            <input
              type="number"
              id="reverseAmount"
              name="amount"
              required
              step="0.01"
              min="0.01"
              max={currentRefundAmount}
              value={reverseAmount}
              onChange={(e) => setReverseAmount(e.target.value)}
              className="w-full rounded-lg border-sky-200 bg-white px-3 py-2 text-sm font-medium text-on-surface outline-none ring-sky-300/50 transition-all focus:border-sky-400 focus:ring-2"
            />
          </div>

          <button
            type="submit"
            disabled={revPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-sky-700 px-4 py-2.5 text-sm font-bold text-white transition-opacity hover:opacity-95 disabled:opacity-70"
          >
            {revPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Undo2 className="h-4 w-4" />}
            {revPending ? "جاري العكس..." : "عكس الاسترداد"}
          </button>
        </form>
      ) : null}
    </div>
  );
}

