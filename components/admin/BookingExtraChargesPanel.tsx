"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Ban, CheckCircle2, Loader2, Plus, ReceiptText } from "lucide-react";
import {
  addBookingExtraChargeAction,
  voidBookingExtraChargeAction,
} from "@/app/admin/booking-extra-charge-actions";
import { SarAmountWithSymbol } from "@/components/ui/SarAmountWithSymbol";
import { formatSarAmount } from "@/lib/booking-checkout-pricing";

type ChargeRow = {
  id: number;
  kind: string;
  description: string;
  amountExclTaxSar: number;
  isTaxable: boolean;
  vatRatePercent: number;
  amountInclTaxSar: number;
  status: string;
  voidedBy: string | null;
  voidReason: string | null;
  createdBy: string | null;
  createdAt: Date;
};

type Props = {
  bookingId: number;
  charges: ChargeRow[];
  activeTotalInclTaxSar: number;
  /** أنواع البنود بتسمياتها العربية — تأتي من الخادم لتبقى مصدراً واحداً. */
  kindOptions: { value: string; label: string }[];
  /** لا تُضاف رسوم على حجز ملغى أو مرفوض. */
  disabled?: boolean;
  disabledReason?: string;
};

const INPUT_CLASS =
  "w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-2.5 text-sm font-medium text-on-surface outline-none ring-primary/50 transition-all focus:border-primary focus:ring-2";

export function BookingExtraChargesPanel({
  bookingId,
  charges,
  activeTotalInclTaxSar,
  kindOptions,
  disabled = false,
  disabledReason,
}: Props) {
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isTaxable, setIsTaxable] = useState(false);
  const [amount, setAmount] = useState("");
  const [isPending, startTransition] = useTransition();

  const amountNum = Number(amount);
  const preview =
    Number.isFinite(amountNum) && amountNum > 0
      ? Math.round(amountNum * (isTaxable ? 1.15 : 1) * 100) / 100
      : null;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    const formData = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await addBookingExtraChargeAction(null, formData);
      if (!res.ok) {
        setError(res.error || "تعذّر حفظ البند.");
        return;
      }
      setFormOpen(false);
      setAmount("");
      setIsTaxable(false);
      setSuccess(true);
      router.refresh();
    });
  }

  function handleVoid(id: number) {
    const reason = prompt("سبب إلغاء البند (يُحفظ في السجل):");
    if (reason === null) return;
    if (!reason.trim()) {
      alert("يرجى كتابة سبب الإلغاء.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await voidBookingExtraChargeAction(id, reason);
      if (!res.ok) {
        setError(res.error || "تعذّر إلغاء البند.");
        return;
      }
      router.refresh();
      if (res.warning) alert(res.warning);
    });
  }

  return (
    <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 shadow-sm">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <h3 className="flex items-center gap-2 text-lg font-bold text-on-surface">
          <ReceiptText className="h-5 w-5 text-amber-700" />
          رسوم إضافية (تلفيات، وقود، مخالفات)
        </h3>
        {!disabled ? (
          <button
            type="button"
            onClick={() => {
              setFormOpen((v) => !v);
              setError(null);
              setSuccess(false);
            }}
            className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary transition-opacity hover:opacity-95"
          >
            <Plus className="h-4 w-4" />
            {formOpen ? "إخفاء النموذج" : "إضافة بند"}
          </button>
        ) : null}
      </div>

      <p className="mb-4 text-xs leading-relaxed text-on-surface-variant">
        كل بند يُضاف مبلغه إلى «مستحق عند الفرع» ليُحصَّل من العميل مع بقية المستحقات —
        نقداً في الفرع أو عبر رابط الدفع الأونلاين.
      </p>

      {disabled ? (
        <div className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm font-semibold text-amber-900">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{disabledReason || "لا يمكن إضافة رسوم على هذا الحجز."}</span>
        </div>
      ) : null}

      {error ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-error-container/50 p-3 text-sm font-semibold text-error">
          <AlertCircle className="h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      ) : null}

      {success ? (
        <div className="mb-4 flex items-center gap-2 rounded-xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-900">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          <span>تمت إضافة البند وتحديث رصيد التحصيل.</span>
        </div>
      ) : null}

      {formOpen && !disabled ? (
        <form
          onSubmit={handleSubmit}
          className="mb-5 space-y-4 rounded-xl border border-outline-variant/30 bg-surface-container-low p-4"
        >
          <input type="hidden" name="bookingId" value={bookingId} />

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="kind" className="mb-1.5 block text-sm font-bold text-on-surface">
                نوع البند <span className="text-error">*</span>
              </label>
              <select id="kind" name="kind" required defaultValue="DAMAGE" className={INPUT_CLASS}>
                {kindOptions.map((k) => (
                  <option key={k.value} value={k.value}>
                    {k.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label
                htmlFor="amountExclTaxSar"
                className="mb-1.5 block text-sm font-bold text-on-surface"
              >
                المبلغ (ر.س) <span className="text-error">*</span>
              </label>
              <input
                type="number"
                id="amountExclTaxSar"
                name="amountExclTaxSar"
                required
                step="0.01"
                min="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="مثال: 500"
                className={INPUT_CLASS}
              />
            </div>
          </div>

          <div>
            <label htmlFor="description" className="mb-1.5 block text-sm font-bold text-on-surface">
              وصف البند <span className="text-error">*</span>
            </label>
            <textarea
              id="description"
              name="description"
              required
              rows={2}
              placeholder="مثال: خدش عميق في الرفرف الأمامي الأيمن — تقرير الورشة رقم 442"
              className={`${INPUT_CLASS} resize-none`}
            />
          </div>

          <label className="flex items-center gap-2.5 text-sm font-semibold text-on-surface">
            <input
              type="checkbox"
              name="isTaxable"
              checked={isTaxable}
              onChange={(e) => setIsTaxable(e.target.checked)}
              className="size-4 rounded border-outline-variant/60 accent-primary"
            />
            خاضع لضريبة القيمة المضافة (15%)
            <span className="text-xs font-medium text-on-surface-variant">
              — التعويض عن التلفيات غالباً غير خاضع
            </span>
          </label>

          {preview !== null ? (
            <div className="rounded-lg bg-primary/5 px-3 py-2 text-sm font-bold text-primary">
              المبلغ المضاف للتحصيل:{" "}
              <SarAmountWithSymbol bold>{formatSarAmount(preview)}</SarAmountWithSymbol>
              {isTaxable ? (
                <span className="ms-2 text-xs font-semibold opacity-80">
                  ({formatSarAmount(amountNum)} + ضريبة 15%)
                </span>
              ) : null}
            </div>
          ) : null}

          <button
            type="submit"
            disabled={isPending}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-on-primary transition-opacity hover:opacity-95 disabled:opacity-70"
          >
            {isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
            {isPending ? "جاري الحفظ..." : "إضافة البند لرصيد التحصيل"}
          </button>
        </form>
      ) : null}

      {/* قائمة البنود */}
      {charges.length === 0 ? (
        <p className="py-6 text-center text-xs text-on-surface-variant">
          لا توجد رسوم إضافية مسجّلة على هذا الحجز.
        </p>
      ) : (
        <>
          <ul className="space-y-2.5">
            {charges.map((c) => {
              const voided = c.status !== "ACTIVE";
              return (
                <li
                  key={c.id}
                  className={`rounded-xl border p-3.5 ${
                    voided
                      ? "border-outline-variant/30 bg-surface-container/40"
                      : "border-amber-200/70 bg-amber-50/50"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`text-sm font-black ${voided ? "text-on-surface-variant line-through" : "text-on-surface"}`}
                        >
                          {kindOptions.find((k) => k.value === c.kind)?.label ?? c.kind}
                        </span>
                        {voided ? (
                          <span className="rounded-full bg-surface-container px-2 py-0.5 text-[11px] font-bold text-on-surface-variant">
                            ملغى
                          </span>
                        ) : null}
                        {c.isTaxable ? (
                          <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-bold text-sky-800">
                            + ضريبة {c.vatRatePercent}%
                          </span>
                        ) : null}
                      </div>
                      <p
                        className={`mt-1 text-xs font-semibold ${voided ? "text-on-surface-variant" : "text-on-surface"}`}
                      >
                        {c.description}
                      </p>
                      <p className="mt-1 text-[11px] font-medium text-on-surface-variant">
                        {c.createdBy ? `سجّلها ${c.createdBy} · ` : ""}
                        {c.createdAt.toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })}
                      </p>
                      {voided && c.voidReason ? (
                        <p className="mt-1 text-[11px] font-semibold text-error">
                          سبب الإلغاء: {c.voidReason}
                          {c.voidedBy ? ` — ${c.voidedBy}` : ""}
                        </p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 items-center gap-3">
                      <span
                        className={`font-extrabold tabular-nums ${voided ? "text-on-surface-variant line-through" : "text-amber-800"}`}
                      >
                        <SarAmountWithSymbol>
                          {formatSarAmount(c.amountInclTaxSar)}
                        </SarAmountWithSymbol>
                      </span>
                      {!voided ? (
                        <button
                          type="button"
                          disabled={isPending}
                          onClick={() => handleVoid(c.id)}
                          className="inline-flex items-center gap-1 rounded-lg border border-error/30 px-2.5 py-1.5 text-[11px] font-bold text-error transition-colors hover:bg-error-container/40 disabled:opacity-50"
                          title="إلغاء البند وخصمه من رصيد التحصيل"
                        >
                          <Ban className="h-3.5 w-3.5" />
                          إلغاء
                        </button>
                      ) : null}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {activeTotalInclTaxSar > 0 ? (
            <div className="mt-4 flex items-center justify-between rounded-xl border border-amber-300/60 bg-amber-100/60 px-4 py-3">
              <span className="text-sm font-black text-amber-900">
                إجمالي الرسوم الإضافية المستحقة
              </span>
              <span className="text-base font-black text-amber-900">
                <SarAmountWithSymbol bold>
                  {formatSarAmount(activeTotalInclTaxSar)}
                </SarAmountWithSymbol>
              </span>
            </div>
          ) : null}
        </>
      )}
    </div>
  );
}
