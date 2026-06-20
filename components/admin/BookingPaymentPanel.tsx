"use client";

import { useState, useActionState } from "react";
import { processBookingPayment } from "@/app/admin/booking-finance-actions";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  CreditCard,
  ChevronDown,
} from "lucide-react";
import {
  ADMIN_OFFICE_PAYMENT_METHODS,
  type BookingPaymentMethod,
} from "@/lib/booking-payment-methods";
import { bookingPaymentMethodLabelAr } from "@/lib/booking-payment-method-label";

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
}: {
  bookingId: number;
  paymentStatus: string;
}) {
  const [state, formAction, isPending] = useActionState(processBookingPayment, null);
  const [method, setMethod] = useState<BookingPaymentMethod>("CASH");
  const [amountValue, setAmountValue] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);

  const statusKey = paymentStatus.trim().toUpperCase();
  const isPaid    = statusKey === "PAID";
  const isRefunded = statusKey === "REFUNDED";

  return (
    <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-100">
          <CreditCard className="h-5 w-5 text-emerald-700" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-on-surface">تسجيل دفعة</h3>
          <p className="text-xs text-on-surface-variant">تسجيل دفع يدوي من الإدارة</p>
        </div>
      </div>

      {isPaid ? (
        <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-semibold text-emerald-900">
          <CheckCircle2 className="h-5 w-5 shrink-0" />
          <span>الحجز مدفوع بالفعل. لا يمكن تسجيل دفعة جديدة.</span>
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
            <label htmlFor="pay-amount" className="mb-1.5 block text-sm font-bold text-on-surface">
              المبلغ المدفوع (ر.س)
            </label>
            <input
              type="number"
              id="pay-amount"
              name="amount"
              required
              step="0.01"
              min="0.01"
              value={amountValue}
              onChange={(e) => setAmountValue(e.target.value)}
              placeholder="مثال: 850.00"
              className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-2.5 text-sm font-medium text-on-surface outline-none ring-primary/50 transition-all focus:border-primary focus:ring-2"
            />
          </div>

          {/* الرقم المرجعي */}
          <div>
            <label htmlFor="pay-externalRef" className="mb-1.5 block text-sm font-bold text-on-surface">
              الرقم المرجعي <span className="font-normal text-on-surface-variant">(اختياري)</span>
            </label>
            <input
              type="text"
              id="pay-externalRef"
              name="externalRef"
              placeholder="مثال: TXN-987654"
              className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-2.5 text-sm font-medium text-on-surface outline-none ring-primary/50 transition-all focus:border-primary focus:ring-2"
            />
          </div>

          {/* اسم المستلِم */}
          <div>
            <label htmlFor="pay-receivedBy" className="mb-1.5 block text-sm font-bold text-on-surface">
              استُلم بواسطة <span className="font-normal text-on-surface-variant">(اختياري)</span>
            </label>
            <input
              type="text"
              id="pay-receivedBy"
              name="receivedBy"
              placeholder="اسم الموظف أو الجهة المستلِمة"
              className="w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-2.5 text-sm font-medium text-on-surface outline-none ring-primary/50 transition-all focus:border-primary focus:ring-2"
            />
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-3 text-sm font-bold text-white transition-opacity hover:opacity-95 disabled:opacity-70"
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
