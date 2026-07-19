"use client";

import { useActionState, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { HandCoins, Loader2 } from "lucide-react";
import { settleCustomerDue } from "@/app/admin/customer-dues-actions";
import { bookingPaymentMethodLabelAr } from "@/lib/booking-payment-method-label";

export function SettleCustomerDueModal({
  bookingId,
  customerName,
  amountSar,
  paymentMethod,
}: {
  bookingId: number;
  customerName: string;
  amountSar: number;
  /** وسيلة الدفع الأصلية للحجز — خيار الاسترداد الإلكتروني عبرها. */
  paymentMethod: string | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"CASH" | "ORIGINAL">(paymentMethod ? "ORIGINAL" : "CASH");
  const [state, formAction, pending] = useActionState(settleCustomerDue, null);

  useEffect(() => {
    if (state?.ok) {
      setOpen(false);
      router.refresh();
    }
  }, [state, router]);

  const originalLabel = paymentMethod
    ? bookingPaymentMethodLabelAr(paymentMethod)
    : null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded bg-[#003749] px-3 py-1.5 text-[11px] font-bold text-white transition-colors hover:bg-[#002735]"
      >
        تسوية المستحقات
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm" dir="rtl">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-outline-variant/20 bg-surface-container-low px-6 py-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-container text-on-primary-container">
                <HandCoins className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-lg font-extrabold text-[#003749]">تسوية مستحقات العميل</h3>
                <p className="text-xs text-on-surface-variant">
                  حجز #{bookingId} — {customerName}
                </p>
              </div>
            </div>

            <form action={formAction} className="p-6">
              <input type="hidden" name="bookingId" value={bookingId} />
              <input type="hidden" name="settleMode" value={mode} />

              <p className="rounded-xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-extrabold text-sky-950">
                المبلغ المستحق للعميل:{" "}
                <span className="tabular-nums" dir="ltr">{amountSar.toLocaleString("en-US", { maximumFractionDigits: 2 })} ر.س</span>
              </p>

              <fieldset className="mt-4 space-y-2">
                <legend className="mb-1 text-sm font-bold text-on-surface">آلية الاسترداد</legend>

                {originalLabel ? (
                  <label
                    className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
                      mode === "ORIGINAL"
                        ? "border-[#003749] bg-[#003749]/[0.04] ring-1 ring-[#003749]/30"
                        : "border-outline-variant/40 hover:bg-surface-container-low"
                    }`}
                  >
                    <input
                      type="radio"
                      name="settleModeRadio"
                      checked={mode === "ORIGINAL"}
                      onChange={() => setMode("ORIGINAL")}
                      className="mt-1"
                    />
                    <span>
                      <span className="font-extrabold text-[#003749]">
                        عبر {originalLabel} (نفس وسيلة الدفع)
                      </span>
                      <span className="mt-0.5 block text-xs text-on-surface-variant">
                        يُنفَّذ الاسترداد إلكترونياً على نفس وسيلة دفع العميل (بوابة الدفع للبطاقات/مدى/Apple Pay).
                      </span>
                    </span>
                  </label>
                ) : null}

                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border px-4 py-3 text-sm transition-colors ${
                    mode === "CASH"
                      ? "border-[#003749] bg-[#003749]/[0.04] ring-1 ring-[#003749]/30"
                      : "border-outline-variant/40 hover:bg-surface-container-low"
                  }`}
                >
                  <input
                    type="radio"
                    name="settleModeRadio"
                    checked={mode === "CASH"}
                    onChange={() => setMode("CASH")}
                    className="mt-1"
                  />
                  <span>
                    <span className="font-extrabold text-[#003749]">نقداً (كاش)</span>
                    <span className="mt-0.5 block text-xs text-on-surface-variant">
                      تسليم المبلغ للعميل نقداً في الفرع، مع مرجع يدوي اختياري للأرشفة.
                    </span>
                  </span>
                </label>
              </fieldset>

              {mode === "CASH" ? (
                <label className="mt-4 block text-sm font-bold text-on-surface">
                  مرجع يدوي (اختياري)
                  <input
                    type="text"
                    name="manualRef"
                    placeholder="مثال: سند صرف رقم 1234"
                    className="mt-2 w-full rounded-xl border border-outline-variant/40 bg-white px-4 py-3 text-sm focus:border-primary/50 focus:ring-2 focus:ring-primary/15"
                  />
                </label>
              ) : null}

              {state?.error && (
                <p className="mt-4 text-xs font-bold text-red-600" role="alert">{state.error}</p>
              )}

              <div className="mt-6 flex gap-3">
                <button
                  type="submit"
                  disabled={pending}
                  className="flex-1 rounded-xl bg-[#003749] py-3 text-sm font-bold text-white transition-colors hover:bg-[#002735] disabled:opacity-50"
                >
                  {pending ? <Loader2 className="mx-auto h-5 w-5 animate-spin" /> : "تأكيد التسوية"}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  disabled={pending}
                  className="flex-1 rounded-xl border border-outline-variant/40 py-3 text-sm font-bold text-on-surface transition-colors hover:bg-surface-container-low disabled:opacity-50"
                >
                  إغلاق
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
