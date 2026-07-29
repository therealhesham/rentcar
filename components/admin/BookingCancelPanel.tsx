"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  cancelAdminBooking,
  cancelAdminBookingWithFullRefund,
  cancelAdminBookingWithoutRefund,
} from "@/app/admin/booking-cancel-actions";
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
  cancellationReasonAr?: string | null;
  /** إجمالي المبلغ المدفوع فعلياً — يُعرض في مودال الاسترداد الكامل. */
  paidAmountSar?: number | null;
  cancellationPolicyAr?: string;
  cancelMinHoursBeforePickup?: number;
  cancellationDeductTiers?: CancellationDeductTier[];
  cancellationFinancePreview?: {
    paidInclTax: number;
    refundInclTax: number;
    methodLabel: string;
  } | null;
  /**
   * يتحكم بظهور «استرداد كامل» و«بلا استرداد» — يُحسب على السيرفر من صلاحيات
   * الجلسة (CANCEL_OVERRIDE أو مدير النظام)، لا يُشتق هنا. الإخفاء عن غير المصرَّح
   * له تجربة أفضل من إظهار خيار سيُرفَض من السيرفر لاحقاً — والسيرفر يتحقق مجدداً
   * دائماً (`requirePermissionForAction`) فلا يُعتمَد على هذا الحقل وحده أمنياً.
   */
  canOverrideCancelPolicy: boolean;
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
  cancellationReasonAr,
  paidAmountSar,
  cancellationPolicyAr = "",
  cancelMinHoursBeforePickup = 0,
  cancellationDeductTiers = [],
  cancellationFinancePreview = null,
  canOverrideCancelPolicy,
}: BookingCancelPanelProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  const [fullRefundModalOpen, setFullRefundModalOpen] = useState(false);
  const [fullRefundReason, setFullRefundReason] = useState("");
  const [fullRefundChannel, setFullRefundChannel] = useState<"ORIGINAL" | "CASH">("ORIGINAL");
  const [fullRefundError, setFullRefundError] = useState<string | null>(null);
  const [fullRefundPending, startFullRefundTransition] = useTransition();

  const [noRefundModalOpen, setNoRefundModalOpen] = useState(false);
  const [noRefundReason, setNoRefundReason] = useState("");
  const [noRefundError, setNoRefundError] = useState<string | null>(null);
  const [noRefundPending, startNoRefundTransition] = useTransition();

  const [cancelMenuOpen, setCancelMenuOpen] = useState(false);

  const statusKey = status.trim().toUpperCase();
  const paymentKey = paymentStatus.trim().toUpperCase();
  const isTerminal =
    statusKey === "CANCELLED" || statusKey === "REJECTED" || statusKey === "RETURNED";
  const isPickedUp = statusKey === "PICKED_UP";

  // «إلغاء مع استرداد كامل» له معنى فقط لحجز مباشر مدفوع فعلاً بمبلغ قابل للرد.
  const eligibleForOverride =
    kind === "DIRECT" && paymentKey === "PAID" && (paidAmountSar ?? 0) > 0;
  // القائمة (سهم الخيارات + الاسترداد الكامل/بلا استرداد) تظهر فقط عند توفر
  // الشرطين معاً: الحجز مؤهّل ماليّاً، والمستخدم يملك صلاحية تجاوز السياسة.
  const canFullRefund = eligibleForOverride && canOverrideCancelPolicy;

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

      {statusKey === "CANCELLED" && cancellationReasonAr?.trim() ? (
        <p className="rounded-lg border border-outline-variant/40 bg-surface-container-low/60 p-2.5 text-xs font-semibold leading-relaxed text-on-surface">
          سبب الإلغاء: <span className="font-bold">{cancellationReasonAr.trim()}</span>
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
        <div className="relative">
          <div className="flex">
            <button
              type="button"
              onClick={() => {
                setCancelMenuOpen(false);
                setCancelError(null);
                setCancelOpen(true);
              }}
              className={`inline-flex flex-1 items-center justify-center border border-red-300 bg-white px-4 py-2.5 text-sm font-bold text-red-800 transition-colors hover:bg-red-50 ${
                canFullRefund ? "rounded-s-xl" : "rounded-xl"
              }`}
            >
              إلغاء الحجز
            </button>
            {canFullRefund ? (
              <button
                type="button"
                aria-label="خيارات الإلغاء"
                aria-expanded={cancelMenuOpen}
                onClick={() => setCancelMenuOpen((v) => !v)}
                className="inline-flex w-11 shrink-0 items-center justify-center rounded-e-xl border border-s-0 border-red-300 bg-red-50 text-red-800 transition-colors hover:bg-red-100"
              >
                <svg
                  viewBox="0 0 24 24"
                  fill="none"
                  className={`h-4 w-4 transition-transform ${cancelMenuOpen ? "rotate-180" : ""}`}
                  aria-hidden
                >
                  <path d="M6 9l6 6 6-6" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
            ) : null}
          </div>

          {cancelMenuOpen && canFullRefund ? (
            <>
              {/* طبقة شفافة لإغلاق القائمة عند النقر خارجها */}
              <div
                className="fixed inset-0 z-30"
                aria-hidden
                onClick={() => setCancelMenuOpen(false)}
              />
              {/* داخل تدفق الكارت (لا absolute): كروت التفاصيل عليها overflow-hidden فتقصّ أي قائمة طافية. */}
              <div className="relative z-40 mt-1.5 w-full overflow-hidden rounded-xl border border-outline-variant/40 bg-white shadow-xl">
                <button
                  type="button"
                  onClick={() => {
                    setCancelMenuOpen(false);
                    setCancelError(null);
                    setCancelOpen(true);
                  }}
                  className="flex w-full flex-col items-start gap-0.5 px-4 py-3 text-start transition-colors hover:bg-red-50"
                >
                  <span className="text-sm font-bold text-red-800">إلغاء الحجز (سياسة العميل)</span>
                  <span className="text-[11px] font-semibold text-on-surface-variant">
                    تُطبَّق شرائح خصم الأيام والاسترداد حسب السياسة.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCancelMenuOpen(false);
                    setFullRefundError(null);
                    setFullRefundReason("");
                    setFullRefundChannel("ORIGINAL");
                    setFullRefundModalOpen(true);
                  }}
                  className="flex w-full flex-col items-start gap-0.5 border-t border-outline-variant/30 px-4 py-3 text-start transition-colors hover:bg-amber-50"
                >
                  <span className="text-sm font-bold text-amber-900">إلغاء مع استرداد كامل</span>
                  <span className="text-[11px] font-semibold text-on-surface-variant">
                    يتجاوز السياسة ويردّ كامل المدفوع — مع اختيار قناة الاسترداد.
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setCancelMenuOpen(false);
                    setNoRefundError(null);
                    setNoRefundReason("");
                    setNoRefundModalOpen(true);
                  }}
                  className="flex w-full flex-col items-start gap-0.5 border-t border-outline-variant/30 px-4 py-3 text-start transition-colors hover:bg-neutral-50"
                >
                  <span className="text-sm font-bold text-neutral-800">إلغاء بلا استرداد</span>
                  <span className="text-[11px] font-semibold text-on-surface-variant">
                    يتجاوز السياسة ويحتجز كامل المدفوع — لا يُرَدّ أي مبلغ للعميل.
                  </span>
                </button>
              </div>
            </>
          ) : null}
        </div>
      )}

      {fullRefundModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          dir="rtl"
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-outline-variant/20 bg-amber-50 px-6 py-4">
              <h3 className="text-lg font-extrabold text-amber-950">إلغاء مع استرداد كامل</h3>
              <p className="mt-1 text-xs font-semibold text-amber-900/80">
                يتجاوز هذا الخيار سياسة خصم الشرائح ويُعيد للعميل كامل المبلغ المدفوع — لحالات
                استثنائية فقط.
              </p>
            </div>

            <div className="p-6">
              {paymentKey === "PAID" && typeof paidAmountSar === "number" && paidAmountSar > 0 ? (
                <p className="mb-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-extrabold text-emerald-950">
                  سيُسترَد للعميل: <SarAmountInline amount={paidAmountSar} />
                  <span className="mr-1 font-semibold text-emerald-900/80">
                    {fullRefundChannel === "CASH"
                      ? "نقداً في الفرع"
                      : paymentMethod
                        ? `عبر ${bookingPaymentMethodLabelAr(paymentMethod)}`
                        : ""}
                  </span>
                </p>
              ) : (
                <p className="mb-4 rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-sm font-bold text-on-surface">
                  لا يوجد مبلغ مدفوع على هذا الحجز — سيتم إلغاؤه فقط بلا استرداد.
                </p>
              )}

              <fieldset className="mb-4 space-y-2">
                <legend className="mb-1 text-sm font-bold text-on-surface">قناة الاسترداد</legend>
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
                    fullRefundChannel === "ORIGINAL"
                      ? "border-[#003749] bg-[#003749]/[0.04] ring-1 ring-[#003749]/30"
                      : "border-outline-variant/40 hover:bg-surface-container-low"
                  }`}
                >
                  <input
                    type="radio"
                    name="fullRefundChannel"
                    checked={fullRefundChannel === "ORIGINAL"}
                    onChange={() => setFullRefundChannel("ORIGINAL")}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-extrabold text-[#003749]">
                      نفس وسيلة الدفع{paymentMethod ? ` (${bookingPaymentMethodLabelAr(paymentMethod)})` : ""}
                    </span>
                    <span className="mt-0.5 block text-xs text-on-surface-variant">
                      استرداد إلكتروني عبر بوابة الدفع على نفس البطاقة/الوسيلة التي دفع بها العميل.
                    </span>
                  </span>
                </label>
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
                    fullRefundChannel === "CASH"
                      ? "border-[#003749] bg-[#003749]/[0.04] ring-1 ring-[#003749]/30"
                      : "border-outline-variant/40 hover:bg-surface-container-low"
                  }`}
                >
                  <input
                    type="radio"
                    name="fullRefundChannel"
                    checked={fullRefundChannel === "CASH"}
                    onChange={() => setFullRefundChannel("CASH")}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-extrabold text-[#003749]">نقداً (كاش)</span>
                    <span className="mt-0.5 block text-xs text-on-surface-variant">
                      تسليم المبلغ للعميل نقداً في الفرع — بلا استرداد إلكتروني.
                    </span>
                  </span>
                </label>
              </fieldset>

              <label className="block text-sm font-bold text-on-surface">
                سبب الاسترداد <span className="text-red-700">*</span>
                <textarea
                  value={fullRefundReason}
                  onChange={(e) => setFullRefundReason(e.target.value)}
                  rows={3}
                  placeholder=""
                  className="mt-2 w-full rounded-xl border border-outline-variant/40 bg-white px-4 py-3 text-sm focus:border-amber-500/60 focus:ring-2 focus:ring-amber-500/15"
                />
              </label>

              {fullRefundError ? (
                <p className="mt-3 text-xs font-bold text-red-700" role="alert">
                  {fullRefundError}
                </p>
              ) : null}

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  disabled={fullRefundPending}
                  onClick={() => {
                    if (!fullRefundReason.trim()) {
                      setFullRefundError("سبب الاسترداد إلزامي.");
                      return;
                    }
                    setFullRefundError(null);
                    startFullRefundTransition(async () => {
                      const fd = new FormData();
                      fd.set("bookingRequestId", String(bookingRequestId));
                      fd.set("reasonAr", fullRefundReason.trim());
                      fd.set("refundChannel", fullRefundChannel);
                      const r = await cancelAdminBookingWithFullRefund(fd);
                      if (!r.ok) {
                        setFullRefundError(r.error ?? "تعذّر تنفيذ الإلغاء والاسترداد.");
                        return;
                      }
                      setFullRefundModalOpen(false);
                      router.refresh();
                    });
                  }}
                  className="flex-1 rounded-xl bg-red-700 py-3 text-sm font-bold text-white transition-colors hover:opacity-95 disabled:opacity-60"
                >
                  {fullRefundPending ? "جاري التنفيذ…" : "تأكيد الإلغاء والاسترداد"}
                </button>
                <button
                  type="button"
                  disabled={fullRefundPending}
                  onClick={() => {
                    setFullRefundModalOpen(false);
                    setFullRefundError(null);
                  }}
                  className="flex-1 rounded-xl border border-outline-variant/40 py-3 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-low disabled:opacity-60"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {noRefundModalOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          dir="rtl"
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="border-b border-outline-variant/20 bg-neutral-100 px-6 py-4">
              <h3 className="text-lg font-extrabold text-neutral-900">إلغاء بلا استرداد</h3>
              <p className="mt-1 text-xs font-semibold text-neutral-600">
                يتجاوز هذا الخيار سياسة خصم الشرائح ويحتجز كامل المبلغ المدفوع — لا يُرَدّ للعميل
                أي شيء. لحالات استثنائية فقط (مخالفة شروط، عدم حضور).
              </p>
            </div>

            <div className="p-6">
              {paymentKey === "PAID" && typeof paidAmountSar === "number" && paidAmountSar > 0 ? (
                <p className="mb-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-extrabold text-red-950">
                  سيُحتجَز: <SarAmountInline amount={paidAmountSar} />
                  <span className="mr-1 font-semibold text-red-900/80">بلا استرداد</span>
                </p>
              ) : (
                <p className="mb-4 rounded-xl border border-outline-variant/40 bg-surface-container-low px-4 py-3 text-sm font-bold text-on-surface">
                  لا يوجد مبلغ مدفوع على هذا الحجز — سيتم إلغاؤه فقط.
                </p>
              )}

              <label className="block text-sm font-bold text-on-surface">
                سبب الإلغاء بلا استرداد <span className="text-red-700">*</span>
                <textarea
                  value={noRefundReason}
                  onChange={(e) => setNoRefundReason(e.target.value)}
                  rows={3}
                  placeholder=""
                  className="mt-2 w-full rounded-xl border border-outline-variant/40 bg-white px-4 py-3 text-sm focus:border-neutral-500/60 focus:ring-2 focus:ring-neutral-500/15"
                />
              </label>

              {noRefundError ? (
                <p className="mt-3 text-xs font-bold text-red-700" role="alert">
                  {noRefundError}
                </p>
              ) : null}

              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  disabled={noRefundPending}
                  onClick={() => {
                    if (!noRefundReason.trim()) {
                      setNoRefundError("سبب الإلغاء بلا استرداد إلزامي.");
                      return;
                    }
                    setNoRefundError(null);
                    startNoRefundTransition(async () => {
                      const fd = new FormData();
                      fd.set("bookingRequestId", String(bookingRequestId));
                      fd.set("reasonAr", noRefundReason.trim());
                      const r = await cancelAdminBookingWithoutRefund(fd);
                      if (!r.ok) {
                        setNoRefundError(r.error ?? "تعذّر تنفيذ الإلغاء بلا استرداد.");
                        return;
                      }
                      setNoRefundModalOpen(false);
                      router.refresh();
                    });
                  }}
                  className="flex-1 rounded-xl bg-neutral-800 py-3 text-sm font-bold text-white transition-colors hover:opacity-95 disabled:opacity-60"
                >
                  {noRefundPending ? "جاري التنفيذ…" : "تأكيد الإلغاء بلا استرداد"}
                </button>
                <button
                  type="button"
                  disabled={noRefundPending}
                  onClick={() => {
                    setNoRefundModalOpen(false);
                    setNoRefundError(null);
                  }}
                  className="flex-1 rounded-xl border border-outline-variant/40 py-3 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-low disabled:opacity-60"
                >
                  إغلاق
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
