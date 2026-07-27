"use client";

import { useEffect, useState, useActionState } from "react";
import { useRouter } from "next/navigation";
import { processBookingPayment } from "@/app/admin/booking-finance-actions";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  CreditCard,
  ChevronDown,
  Wand2,
} from "lucide-react";
import {
  ADMIN_OFFICE_PAYMENT_METHODS,
  type BookingPaymentMethod,
} from "@/lib/booking-payment-methods";
import { bookingPaymentMethodLabelAr } from "@/lib/booking-payment-method-label";
import { formatSarAmount } from "@/lib/booking-checkout-pricing";

const METHOD_ICONS: Partial<Record<BookingPaymentMethod, string>> = {
  CASH:      "💵",
  CARD:      "💳",
  MADA:      "🏧",
  AMKAN:     "🔵",
  TABBY:     "⚡",
  TAMARA:    "🌙",
  APPLE_PAY: "🍎",
  POINTS:    "⭐",
};

export function BookingPaymentPanel({
  bookingId,
  paymentStatus,
  fullAmountSar,
}: {
  bookingId: number;
  paymentStatus: string;
  /** المبلغ الكلي المتبقي على الحجز — يُستخدم لتعبئة الحقل بضغطة واحدة */
  fullAmountSar?: number | null;
}) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(processBookingPayment, null);
  const [method, setMethod] = useState<BookingPaymentMethod>("CASH");
  const [amountValue, setAmountValue] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // تفريغ الحقل عند وصول نتيجة ناجحة جديدة — تعديل الحالة أثناء الرسم
  // (النمط الموصى به) بدل setState داخل useEffect الذي يسبب رسماً متتالياً.
  const [seenState, setSeenState] = useState(state);
  if (state !== seenState) {
    setSeenState(state);
    if (state?.ok) setAmountValue("");
  }

  // revalidatePath في الإجراء لا يعيد رسم هذه الصفحة وحده، فتبقى الأرقام (الرصيد
  // المتبقي وملخص الدفع ودفتر الحجز) قديمة بعد التحصيل حتى تحديث يدوي.
  // `state` مرجع جديد لكل استدعاء، فالتأثير يعمل مرة واحدة لكل دفعة ناجحة.
  useEffect(() => {
    if (!state?.ok) return;
    router.refresh();
  }, [state, router]);

  const statusKey = paymentStatus.trim().toUpperCase();
  const isPaid    = statusKey === "PAID";
  const isRefunded = statusKey === "REFUNDED" || statusKey === "PARTIAL_REFUND";
  const outstandingSar = fullAmountSar ?? 0;
  // مدفوع بالكامل فقط إذا لم يبقَ رصيد؛ وجود رصيد (بعد تمديد مثلاً) يتيح تسجيل تحصيله.
  const fullyPaid = isPaid && outstandingSar <= 0;
  const isBalanceCollection = isPaid && outstandingSar > 0;

  // سقف المبلغ = المتبقي المستحق؛ لا يُسمح بتسجيل دفعة تتجاوزه.
  const maxAmount =
    fullAmountSar != null && fullAmountSar > 0
      ? Math.round(fullAmountSar * 100) / 100
      : null;
  const numAmount = Number(amountValue);
  const exceedsMax =
    maxAmount != null && Number.isFinite(numAmount) && numAmount > maxAmount + 0.001;

  return (
    <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
          <CreditCard className="h-5 w-5 text-emerald-700" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-on-surface">
            {isBalanceCollection ? "تحصيل الرصيد المتبقي" : "تسجيل دفعة"}
          </h3>
          <p className="text-xs text-on-surface-variant">تسجيل دفع يدوي من الإدارة</p>
        </div>
      </div>

      {fullyPaid ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>الحجز مدفوع بالكامل. لا يوجد رصيد متبقٍ للتحصيل.</span>
        </div>
      ) : isRefunded ? (
        <div className="flex items-center gap-2 rounded-xl border border-sky-200 bg-sky-50 p-4 text-sm font-semibold text-sky-900">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>الحجز مسترد ولا يمكن تسجيل دفعة عليه.</span>
        </div>
      ) : (
        <form action={formAction} className="space-y-5">
          <input type="hidden" name="bookingId" value={bookingId} />
          <input type="hidden" name="paymentMethod" value={method} />

          {isBalanceCollection ? (
            <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm font-semibold text-amber-900">
              <AlertCircle className="h-4 w-4 shrink-0 translate-y-0.5" />
              <span>
                الحجز مدفوع جزئياً — سجّل تحصيل الرصيد المتبقي البالغ{" "}
                <span dir="ltr" className="tabular-nums">
                  {formatSarAmount(outstandingSar)} ر.س
                </span>
                .
              </span>
            </div>
          ) : null}

          {state?.error ? (
            <div className="flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-800">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{state.error}</span>
            </div>
          ) : null}

          {state?.ok ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
              <CheckCircle2 className="h-4 w-4 shrink-0" />
              <span>تم تسجيل الدفعة بنجاح.</span>
            </div>
          ) : null}

          {/* طريقة الدفع */}
          <div>
            <label className="mb-1.5 block text-sm font-bold text-on-surface">
              طريقة الدفع
            </label>
            <div className="relative">
              <button
                type="button"
                onClick={() => setDropdownOpen((v) => !v)}
                className="flex w-full items-center justify-between rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-2.5 text-sm font-semibold text-on-surface transition-colors hover:bg-surface-container-low focus:outline-none"
              >
                <span className="flex items-center gap-2">
                  <span>{METHOD_ICONS[method] ?? "💳"}</span>
                  <span>{bookingPaymentMethodLabelAr(method)}</span>
                </span>
                <ChevronDown
                  className={`h-4 w-4 text-on-surface-variant transition-transform ${dropdownOpen ? "rotate-180" : ""}`}
                />
              </button>

              {dropdownOpen ? (
                <div className="absolute inset-x-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container-lowest shadow-lg">
                  {ADMIN_OFFICE_PAYMENT_METHODS.map((m) => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => {
                        setMethod(m);
                        setDropdownOpen(false);
                      }}
                      className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-surface-container-low ${
                        m === method
                          ? "bg-primary/8 text-primary"
                          : "text-on-surface"
                      }`}
                    >
                      <span>{METHOD_ICONS[m] ?? "💳"}</span>
                      <span>{bookingPaymentMethodLabelAr(m)}</span>
                      {m === method ? (
                        <CheckCircle2 className="mr-auto h-3.5 w-3.5 text-primary" />
                      ) : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          </div>

          {/* المبلغ */}
          <div>
            <div className="mb-1.5 flex items-center justify-between gap-2">
              <label htmlFor="pay-amount" className="block text-sm font-bold text-on-surface">
                المبلغ المدفوع (ر.س)
              </label>
              {fullAmountSar != null && fullAmountSar > 0 ? (
                <button
                  type="button"
                  onClick={() => setAmountValue((Math.round(fullAmountSar * 100) / 100).toFixed(2))}
                  className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary transition-colors hover:bg-primary/15"
                >
                  <Wand2 className="h-3.5 w-3.5" aria-hidden />
                  كامل المبلغ
                  <span dir="ltr" className="text-primary/70">
                    ({formatSarAmount(fullAmountSar)})
                  </span>
                </button>
              ) : null}
            </div>
            <input
              type="number"
              id="pay-amount"
              name="amount"
              required
              step="0.01"
              min="0.01"
              max={maxAmount ?? undefined}
              value={amountValue}
              onChange={(e) => setAmountValue(e.target.value)}
              placeholder="مثال: 850.00"
              className={`w-full rounded-xl border bg-surface-container-lowest px-4 py-2.5 text-sm font-medium text-on-surface outline-none transition-all focus:ring-2 ${
                exceedsMax
                  ? "border-red-300 ring-red-200 focus:border-red-400"
                  : "border-outline-variant/40 ring-primary/50 focus:border-primary"
              }`}
            />
            {exceedsMax && maxAmount != null ? (
              <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-red-700">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden />
                لا يمكن تجاوز المبلغ المتبقي البالغ{" "}
                <span dir="ltr" className="tabular-nums">
                  {formatSarAmount(maxAmount)} ر.س
                </span>
                .
              </p>
            ) : null}
            {fullAmountSar != null &&
            fullAmountSar > 0 &&
            amountValue === (Math.round(fullAmountSar * 100) / 100).toFixed(2) ? (
              <p className="mt-1.5 flex items-center gap-1 text-xs font-semibold text-primary">
                <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
                تم تعبئة كامل المبلغ المستحق
              </p>
            ) : null}
          </div>

          <p className="flex items-center gap-1.5 text-xs text-on-surface-variant">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
            يُسجَّل المرجع واسم المستلِم تلقائياً باسم الموظف الحالي.
          </p>

          <button
            type="submit"
            disabled={isPending || exceedsMax}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition-opacity hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <CreditCard className="h-5 w-5" />
            )}
            {isPending ? "جاري التسجيل..." : "تسجيل الدفعة"}
          </button>
        </form>
      )}
    </div>
  );
}
