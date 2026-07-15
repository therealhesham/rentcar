"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { cancelAdminBooking } from "@/app/admin/booking-cancel-actions";
import { SarCurrencyGlyph } from "@/components/ui/SarCurrencyGlyph";
import { formatSarAmount } from "@/lib/booking-checkout-pricing";
import { bookingPaymentMethodLabelAr } from "@/lib/booking-payment-method-label";
import {
  type CancellationDeductTier,
  computeCancellationDeductedDays,
  computePickedUpCancellationDeductDays,
  formatDeductDaysSummaryAr,
  hoursBeforePickup,
} from "@/lib/cancellation-deduct";

export type BookingCancelPanelProps = {
  bookingRequestId: number;
  kind: string;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  pickupDateIso: string;
  numberOfDays: number;
  cancellationDeductedDays?: number | null;
  cancellationRefundAmountSar?: number | null;
  cancellationRefundExternalRef?: string | null;
  cancellationPolicyAr?: string;
  cancelMinHoursBeforePickup?: number;
  cancellationDeductTiers?: CancellationDeductTier[];
  cancellationFinancePreview?: {
    paidInclTax: number;
    refundInclTax: number;
    methodLabel: string;
  } | null;
};

function SarAmountInline({ amount }: { amount: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 tabular-nums" dir="ltr">
      {formatSarAmount(amount)}
      <SarCurrencyGlyph className="h-[0.85em] w-[0.85em] shrink-0" />
    </span>
  );
}

export function BookingCancelPanel({
  bookingRequestId,
  kind,
  status,
  paymentStatus,
  paymentMethod,
  pickupDateIso,
  numberOfDays,
  cancellationDeductedDays,
  cancellationRefundAmountSar,
  cancellationRefundExternalRef,
  cancellationPolicyAr = "",
  cancelMinHoursBeforePickup = 0,
  cancellationDeductTiers = [],
  cancellationFinancePreview = null,
}: BookingCancelPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const statusKey = status.trim().toUpperCase();
  const paymentKey = paymentStatus.trim().toUpperCase();
  const isTerminal =
    statusKey === "CANCELLED" || statusKey === "REJECTED" || statusKey === "RETURNED";
  const isPickedUp = statusKey === "PICKED_UP";

  const previewDeductDays = useMemo(() => {
    if (!cancellationDeductTiers.length) return 0;
    const pickupDate = new Date(pickupDateIso);
    if (isPickedUp) {
      return computePickedUpCancellationDeductDays(
        pickupDate,
        numberOfDays,
        cancellationDeductTiers,
      );
    }
    const h = hoursBeforePickup(pickupDate, new Date());
    return computeCancellationDeductedDays(h, cancellationDeductTiers, numberOfDays);
  }, [numberOfDays, pickupDateIso, cancellationDeductTiers, isPickedUp]);

  if (isTerminal && statusKey !== "CANCELLED") {
    return null;
  }

  return (
    <div className="space-y-3">
      {cancelError ? (
        <p className="text-xs font-bold text-red-700" role="alert">
          {cancelError}
        </p>
      ) : null}

      {statusKey === "CANCELLED" &&
      cancellationDeductedDays != null &&
      cancellationDeductedDays > 0 ? (
        <p className="text-xs font-semibold leading-relaxed text-on-surface-variant">
          عند الإلغاء سُجِّل خصم مدة:{" "}
          <span className="font-bold tabular-nums text-on-surface">
            {formatDeductDaysSummaryAr(cancellationDeductedDays)}
          </span>
          .
        </p>
      ) : null}

      {statusKey === "CANCELLED" &&
      paymentMethod &&
      (cancellationRefundAmountSar != null ||
        paymentKey === "REFUNDED" ||
        paymentKey === "PARTIAL_REFUND" ||
        paymentKey === "NO_REFUND") ? (
        <p className="text-xs font-semibold leading-relaxed text-on-surface-variant">
          الاسترداد عبر{" "}
          <span className="font-bold text-on-surface">
            {bookingPaymentMethodLabelAr(paymentMethod)}
          </span>
          {typeof cancellationRefundAmountSar === "number" ? (
            <>
              : مبلغ مسترد{" "}
              <span className="font-bold text-on-surface">
                <SarAmountInline amount={cancellationRefundAmountSar} />
              </span>
              {cancellationRefundExternalRef?.startsWith("MOCK") ? (
                <span className="ms-1 text-[11px] text-on-surface-variant">
                  (محاكاة بوابة)
                </span>
              ) : null}
            </>
          ) : paymentKey === "NO_REFUND" ? (
            <span className="font-bold text-on-surface">: لا يوجد مبلغ مسترد بحسب السياسة.</span>
          ) : null}
        </p>
      ) : null}

      {statusKey === "CANCELLED" ? null : cancelOpen ? (
        <div className="rounded-xl border border-red-200 bg-red-50/90 p-4 text-sm">
          <p className="mb-3 text-xs font-semibold leading-relaxed text-amber-950">
            كموظف إدارة يمكنك الإلغاء حتى بعد انتهاء مهلة العميل (
            {cancelMinHoursBeforePickup > 0
              ? `${cancelMinHoursBeforePickup} ساعة قبل الاستلام`
              : "بدون مهلة محددة"}
            ). تُطبَّق شرائح خصم الأيام والاسترداد كما في حساب العميل.
          </p>

          {isPickedUp ? (
            <p className="mb-3 rounded-lg border border-red-300 bg-red-100/90 p-2.5 text-xs font-bold leading-relaxed text-red-950">
              {"تنبيه: السيارة سُلِّمت للعميل بالفعل. هذا إلغاء مبكر — تُحتجز الأيام المنقضية منذ الاستلام بالكامل، وتُطبَّق شرائح السياسة أيضاً على الأيام المتبقية فقط (لا استرداد كامل تلقائي لبقية المدة)."}
            </p>
          ) : null}

          {cancellationPolicyAr.trim() ? (
            <div className="mb-3 max-h-44 overflow-y-auto rounded-lg border border-red-200/60 bg-white/80 p-3 text-xs font-semibold leading-relaxed text-red-950 whitespace-pre-wrap">
              {cancellationPolicyAr.trim()}
            </div>
          ) : null}

          {cancellationDeductTiers.length > 0 ? (
            <p className="mb-3 rounded-lg border border-amber-200/80 bg-amber-50/90 p-2.5 text-xs font-bold leading-relaxed text-amber-950">
              عند تأكيد الإلغاء الآن يُسجَّل خصم:{" "}
              <span className="tabular-nums">{formatDeductDaysSummaryAr(previewDeductDays)}</span>{" "}
              من مدة الإيجار (بحد أقصى {numberOfDays} يوم للحجز).
            </p>
          ) : null}

          {kind === "DIRECT" && paymentKey === "PENDING" ? (
            <p className="mb-3 rounded-lg border border-outline-variant/40 bg-white/80 p-2.5 text-xs font-bold text-on-surface">
              لم يُدفع هذا الحجز بعد — لا يوجد استرداد نقدي؛ سيتم إلغاء الطلب فقط.
            </p>
          ) : null}

          {kind === "DIRECT" && paymentKey === "PAID" && cancellationFinancePreview ? (
            <div className="mb-3 space-y-2 rounded-lg border border-emerald-200/80 bg-emerald-50/90 p-2.5 text-xs font-bold leading-relaxed text-emerald-950">
              <p>
                المدفوع سابقاً (شامل الضريبة):{" "}
                <SarAmountInline amount={cancellationFinancePreview.paidInclTax} />
              </p>
              <p>
                المبلغ المقدَّر للاسترداد عبر{" "}
                <span className="text-emerald-900">{cancellationFinancePreview.methodLabel}</span>:{" "}
                <SarAmountInline amount={cancellationFinancePreview.refundInclTax} />
              </p>
              <p className="text-[11px] font-semibold text-emerald-900/90">
                يُنفَّذ الاسترداد آلياً عبر نفس وسيلة الدفع عند التأكيد (محاكاة حتى ربط البوابة).
              </p>
            </div>
          ) : null}

          <p className="mb-3 text-xs font-semibold text-red-950">
            هل تريد إلغاء هذا الطلب؟ لا يمكن التراجع بعد التأكيد.
          </p>

          <div className="flex flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setCancelError(null);
                startTransition(async () => {
                  const fd = new FormData();
                  fd.set("bookingRequestId", String(bookingRequestId));
                  const r = await cancelAdminBooking(fd);
                  if (!r.ok) {
                    setCancelError(r.error ?? "تعذّر الإلغاء.");
                    return;
                  }
                  setCancelOpen(false);
                  router.refresh();
                });
              }}
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white hover:opacity-95 disabled:opacity-60"
            >
              {pending ? "جاري الإلغاء…" : "تأكيد إلغاء الحجز"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setCancelOpen(false);
                setCancelError(null);
              }}
              className="inline-flex flex-1 items-center justify-center rounded-xl border border-outline-variant bg-white px-4 py-2.5 text-sm font-bold text-on-surface hover:bg-surface-container-low"
            >
              تراجع
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => {
            setCancelError(null);
            setCancelOpen(true);
          }}
          className="w-full rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-bold text-red-800 transition-colors hover:bg-red-50"
        >
          إلغاء الحجز (سياسة العميل)
        </button>
      )}
    </div>
  );
}
