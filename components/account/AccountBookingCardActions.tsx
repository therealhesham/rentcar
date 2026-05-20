"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { cancelCustomerBooking } from "@/app/account/actions";
import { SarCurrencyGlyph } from "@/components/ui/SarCurrencyGlyph";
import { formatSarAmount } from "@/lib/booking-checkout-pricing";
import { bookingPaymentMethodLabelAr } from "@/lib/booking-payment-method-label";
import {
  type CancellationDeductTier,
  computeCancellationDeductedDays,
  formatDeductDaysSummaryAr,
  hoursBeforePickup,
} from "@/lib/cancellation-deduct";
import { hrefFreshRebookCheckoutFromBooking, hrefRebookFromBooking } from "@/lib/rebook-booking-url";

export type AccountBookingCardActionsProps = {
  booking: {
    id: number;
    kind: "INQUIRY" | "DIRECT";
    carModelId: number | null;
    pickupDateIso: string;
    numberOfDays: number;
    pickupMode: string | null;
    pickupBranchSlug: string | null;
    returnBranchSlug: string;
    deliveryLat: number | null;
    deliveryLng: number | null;
    deliveryAddress: string | null;
    paymentStatus: string;
    paymentMethod?: string | null;
    status: string;
    /** يُملأ بعد إلغاء ذاتي عندما وُجد خصم أيام */
    cancellationDeductedDays?: number | null;
    cancellationRefundAmountSar?: number | null;
    cancellationRefundExternalRef?: string | null;
  };
  /** نص من لوحة الإدارة يُعرض عند تأكيد الإلغاء */
  cancellationPolicyAr?: string;
  /** مهلة الإلغاء بالساعات قبل الاستلام (٠ = بدون تقييد) */
  cancelMinHoursBeforePickup?: number;
  /** شرائح خصم الأيام من الإعدادات */
  cancellationDeductTiers?: CancellationDeductTier[];
  /** معاينة مالية للحجوزات المدفوعة قبل الإلغاء */
  cancellationFinancePreview?: {
    paidInclTax: number;
    refundInclTax: number;
    methodLabel: string;
  } | null;
};

function isSelfCancelPastDeadline(pickupIso: string, minHours: number): boolean {
  if (minHours <= 0) return false;
  const pickupMs = new Date(pickupIso).getTime();
  const now = Date.now();
  if (!(pickupMs > now)) return false;
  const lastAllowedMs = pickupMs - minHours * 60 * 60 * 1000;
  return now >= lastAllowedMs;
}

function SarAmountInline({ amount }: { amount: number }) {
  return (
    <span className="inline-flex items-center gap-0.5 tabular-nums" dir="ltr">
      {formatSarAmount(amount)}
      <SarCurrencyGlyph className="h-[0.85em] w-[0.85em] shrink-0" />
    </span>
  );
}

export function AccountBookingCardActions({
  booking: b,
  cancellationPolicyAr = "",
  cancelMinHoursBeforePickup = 0,
  cancellationDeductTiers = [],
  cancellationFinancePreview = null,
}: AccountBookingCardActionsProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const statusKey = b.status.trim().toUpperCase();
  const isTerminal = statusKey === "CANCELLED" || statusKey === "REJECTED";
  const paymentKey = b.paymentStatus.trim().toUpperCase();

  const previewDeductDays = useMemo(() => {
    if (!cancellationDeductTiers.length) return 0;
    const h = hoursBeforePickup(new Date(b.pickupDateIso), new Date());
    return computeCancellationDeductedDays(h, cancellationDeductTiers, b.numberOfDays);
  }, [b.numberOfDays, b.pickupDateIso, cancellationDeductTiers]);

  const rebookLike = {
    kind: b.kind,
    carModelId: b.carModelId,
    pickupDate: new Date(b.pickupDateIso),
    numberOfDays: b.numberOfDays,
    pickupMode: b.pickupMode,
    pickupBranchSlug: b.pickupBranchSlug,
    returnBranchSlug: b.returnBranchSlug,
    deliveryLat: b.deliveryLat,
    deliveryLng: b.deliveryLng,
    deliveryAddress: b.deliveryAddress,
    excludeBookingRequestId: b.id,
  };

  const editCheckoutHref = hrefRebookFromBooking(rebookLike);
  const rebookCheckoutHref = hrefFreshRebookCheckoutFromBooking(rebookLike);

  const showDirectLinks = b.kind === "DIRECT" && b.carModelId != null && b.carModelId >= 1;

  const cancelPastDeadline = isSelfCancelPastDeadline(
    b.pickupDateIso,
    cancelMinHoursBeforePickup,
  );
  const cancelDeadlineTitle =
    cancelPastDeadline && cancelMinHoursBeforePickup > 0
      ? `انتهت مهلة الإلغاء . يجب الإلغاء قبل موعد الاستلام بأكثر من ${cancelMinHoursBeforePickup} ساعة.`
      : undefined;

  return (
    <div className="mt-4 flex flex-col gap-2">
      {cancelError ? (
        <p className="text-[12px] font-bold text-red-600" role="alert">
          {cancelError}
        </p>
      ) : null}

      {statusKey === "CANCELLED" &&
      b.cancellationDeductedDays != null &&
      b.cancellationDeductedDays > 0 ? (
        <p className="text-[12px] font-bold leading-relaxed text-on-surface-variant">
          عند الإلغاء سُجِّل خصم مدة:{" "}
          <span className="tabular-nums text-on-surface">
            {formatDeductDaysSummaryAr(b.cancellationDeductedDays)}
          </span>
          .
        </p>
      ) : null}

      {statusKey === "CANCELLED" &&
      b.paymentMethod &&
      (b.cancellationRefundAmountSar != null ||
        paymentKey === "REFUNDED" ||
        paymentKey === "PARTIAL_REFUND" ||
        paymentKey === "NO_REFUND") ? (
        <p className="text-[12px] font-bold leading-relaxed text-on-surface-variant">
          الاسترداد عبر{" "}
          <span className="text-on-surface">{bookingPaymentMethodLabelAr(b.paymentMethod)}</span>
          {typeof b.cancellationRefundAmountSar === "number" ? (
            <>
              : مبلغ مسترد{" "}
              <span className="text-on-surface">
                <SarAmountInline amount={b.cancellationRefundAmountSar} />
              </span>
              {b.cancellationRefundExternalRef?.startsWith("MOCK") ? (
                <span className="ms-1 text-[11px] font-semibold text-on-surface-variant">
                  (محاكاة بوابة — جاهز لربط تابي/تمارا/البوابة)
                </span>
              ) : null}
            </>
          ) : paymentKey === "NO_REFUND" ? (
            <span className="text-on-surface">: لا يوجد مبلغ مسترد بحسب السياسة.</span>
          ) : null}
        </p>
      ) : null}

      {cancelOpen ? (
        <div className="rounded-xl border border-red-200 bg-red-50/80 p-3 text-[13px] font-semibold text-red-950">
          {cancellationPolicyAr.trim() ? (
            <div className="mb-3 max-h-44 overflow-y-auto rounded-lg border border-red-200/50 bg-white/60 p-3 text-[12px] font-semibold leading-relaxed text-red-950/95 whitespace-pre-wrap">
              {cancellationPolicyAr.trim()}
            </div>
          ) : null}
          {cancellationDeductTiers.length > 0 ? (
            <p className="mb-3 rounded-lg border border-amber-200/80 bg-amber-50/90 p-2.5 text-[12px] font-bold leading-relaxed text-amber-950">
              بحسب الإعدادات الحالية، عند تأكيد الإلغاء الآن يُسجَّل خصم:{" "}
              <span className="tabular-nums">{formatDeductDaysSummaryAr(previewDeductDays)}</span>{" "}
              من مدة الإيجار (بحد أقصى {b.numberOfDays} يوم للحجز).
            </p>
          ) : null}

          {b.kind === "DIRECT" && paymentKey === "PENDING" ? (
            <p className="mb-3 rounded-lg border border-neutral-200 bg-white/70 p-2.5 text-[12px] font-bold text-on-surface">
              لم يُدفع هذا الحجز بعد — لا يوجد استرداد نقدي؛ سيتم إلغاء الطلب فقط.
            </p>
          ) : null}

          {b.kind === "DIRECT" && paymentKey === "PAID" && cancellationFinancePreview ? (
            <div className="mb-3 space-y-2 rounded-lg border border-emerald-200/80 bg-emerald-50/90 p-2.5 text-[12px] font-bold leading-relaxed text-emerald-950">
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
                يُنفَّذ الاسترداد آلياً عبر نفس وسيلة الدفع عند التأكيد (الربط الفعلي بالبوابة يُكمَّل
                لاحقاً؛ حالياً تُسجَّل العملية كمحاكاة ناجحة).
              </p>
            </div>
          ) : null}

          <p className="mb-3">هل تريد إلغاء هذا الطلب؟ لا يمكن التراجع بعد التأكيد.</p>

          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setCancelError(null);
                startTransition(async () => {
                  const fd = new FormData();
                  fd.set("bookingId", String(b.id));
                  const r = await cancelCustomerBooking(fd);
                  if (!r.ok) {
                    setCancelError(r.error ?? "تعذّر الإلغاء.");
                    return;
                  }
                  setCancelOpen(false);
                  router.refresh();
                });
              }}
              className="inline-flex flex-1 items-center justify-center rounded-xl bg-red-700 px-4 py-2.5 text-sm font-extrabold text-white shadow-sm transition-opacity hover:opacity-95 disabled:opacity-60"
            >
              {pending ? "جاري الإلغاء…" : "تأكيد الغاء الحجز"}
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                setCancelOpen(false);
                setCancelError(null);
              }}
              className="inline-flex flex-1 items-center justify-center rounded-xl border-2 border-[#003749] bg-white px-4 py-2.5 text-sm font-extrabold text-[#003749] shadow-sm transition-colors hover:bg-[#003749]/5"
            >
              حفظ الحجز (تراجع)
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
          {b.paymentStatus === "PENDING" && b.kind === "DIRECT" ? (
            <Link
              href={`/fleet/payment/${b.id}`}
              className="inline-flex w-full items-center justify-center rounded-xl bg-[#ea580c] px-4 py-2.5 text-center text-sm font-extrabold text-white shadow-sm transition-opacity hover:opacity-95 sm:w-auto sm:flex-1"
            >
              إتمام الدفع
            </Link>
          ) : null}

          {showDirectLinks ? (
            <>
              <Link
                href={editCheckoutHref}
                className="inline-flex w-full items-center justify-center rounded-xl border-2 border-[#003749] bg-white px-4 py-2.5 text-center text-sm font-extrabold text-[#003749] shadow-sm transition-colors hover:bg-[#003749]/5 sm:w-auto sm:flex-1"
              >
                تعديل الحجز
              </Link>
              <Link
                href={rebookCheckoutHref}
                className="inline-flex w-full items-center justify-center rounded-xl bg-[#003749] px-4 py-2.5 text-center text-sm font-extrabold text-white shadow-sm transition-opacity hover:opacity-95 sm:w-auto sm:flex-1"
              >
                إعادة الحجز
              </Link>
            </>
          ) : b.kind === "INQUIRY" ? (
            <Link
              href="/fleet"
              className="inline-flex w-full items-center justify-center rounded-xl border-2 border-[#003749] bg-white px-4 py-2.5 text-center text-sm font-extrabold text-[#003749] shadow-sm transition-colors hover:bg-[#003749]/5 sm:w-auto"
            >
              طلب حجز جديد
            </Link>
          ) : null}

          <button
            type="button"
            disabled={cancelPastDeadline || isTerminal}
            title={cancelDeadlineTitle}
            onClick={() => {
              setCancelError(null);
              setCancelOpen(true);
            }}
            className="inline-flex w-full items-center justify-center rounded-xl border border-red-300 bg-white px-4 py-2.5 text-sm font-extrabold text-red-800 shadow-sm transition-colors hover:bg-red-50 enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-55 sm:w-auto sm:flex-1"
          >
            الغاء الحجز
          </button>
        </div>
      )}
    </div>
  );
}
