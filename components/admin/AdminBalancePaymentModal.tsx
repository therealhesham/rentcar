"use client";

import { useState, useTransition } from "react";
import { CreditCard, Loader2 } from "lucide-react";
import { processAdminBalancePayment } from "@/app/admin/booking-request-actions";
import { SarAmountWithSymbol } from "@/components/ui/SarAmountWithSymbol";
import { formatSarAmount } from "@/lib/booking-checkout-pricing";

type Props = {
  bookingId: number;
  balanceDue: number;
  onCloseModal?: () => void;
};

const PAYMENT_METHODS = [
  { value: "CASH", label: "عند الفرع" },
  { value: "MADA", label: "مدى" },
  { value: "CARD", label: "بطاقة ائتمانية" },
  { value: "APPLE_PAY", label: "Apple Pay" },
  { value: "TABBY", label: "تابي" },
  { value: "TAMARA", label: "تمارا" },
  { value: "AMKAN", label: "إمكان" },
];

export function AdminBalancePaymentModalInner({ bookingId, balanceDue, onClose }: { bookingId: number; balanceDue: number; onClose: () => void }) {
  const [method, setMethod] = useState("CASH");
  const [errorMsg, setErrorMsg] = useState("");
  const [isPending, startTransition] = useTransition();

  const handleConfirm = () => {
    setErrorMsg("");
    startTransition(async () => {
      const result = await processAdminBalancePayment(bookingId, method);
      if (!result.ok) {
        setErrorMsg(result.error || "حدث خطأ أثناء التأكيد");
      } else {
        onClose();
      }
    });
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-inverse-surface/50 backdrop-blur-sm cursor-default"
        onClick={() => !isPending && onClose()}
      />
      <div className="relative z-10 w-full max-w-sm rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 editorial-shadow">
        <h3 className="text-lg font-extrabold text-on-surface">
          سداد الدفعة المتبقية
        </h3>
        <p className="mt-1 text-sm text-on-surface-variant">
          تسجيل سداد الدفعة المتبقية البالغة:{" "}
          <SarAmountWithSymbol amountClassName="font-bold text-amber-700" glyphClassName="text-amber-900">
            {formatSarAmount(balanceDue)}
          </SarAmountWithSymbol>
        </p>

        <div className="mt-4">
          {errorMsg && (
            <div className="mb-4 rounded-xl bg-error-container/40 px-3 py-2 text-sm font-bold text-error">
              {errorMsg}
            </div>
          )}
          <label className="block text-sm font-bold text-on-surface">
            وسيلة الدفع
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              disabled={isPending}
              className="mt-1 w-full rounded-xl border border-outline-variant bg-surface-container-lowest px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-primary"
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={isPending}
            className="cursor-pointer rounded-xl px-4 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface-container transition-colors disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={isPending}
            className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-amber-600 px-5 py-2 text-sm font-bold text-white hover:opacity-95 disabled:opacity-60"
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            تأكيد السداد
          </button>
        </div>
      </div>
    </div>
  );
}

export function AdminBalancePaymentModal({ bookingId, balanceDue, onCloseModal }: Props) {
  return (
    <AdminBalancePaymentModalInner
      bookingId={bookingId}
      balanceDue={balanceDue}
      onClose={onCloseModal ?? (() => {})}
    />
  );
}
