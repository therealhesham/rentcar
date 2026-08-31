"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, BadgePercent, CheckCircle2, Loader2, Tag } from "lucide-react";
import {
  applyAdminCouponAction,
  previewAdminCouponAction,
} from "@/app/admin/booking-coupon-actions";
import type { AdminCouponPreviewResult } from "@/lib/booking-coupon-admin-apply";
import { SarAmountWithSymbol } from "@/components/ui/SarAmountWithSymbol";
import { formatSarAmount } from "@/lib/booking-checkout-pricing";

type Props = {
  bookingId: number;
  appliedCouponCode: string | null;
  appliedCouponScope: "RENTAL_ONLY" | "FULL_TOTAL" | null;
  /** لا يجوز تطبيق كوبون على حجز غير مباشر أو ملغى/مرفوض. */
  disabled?: boolean;
  disabledReason?: string;
};

const INPUT_CLASS =
  "w-full rounded-xl border border-outline-variant/40 bg-surface-container-lowest px-4 py-2.5 text-sm font-medium text-on-surface outline-none ring-primary/50 transition-all focus:border-primary focus:ring-2";

function scopeLabelAr(scope: "RENTAL_ONLY" | "FULL_TOTAL"): string {
  return scope === "RENTAL_ONLY" ? "سعر الإيجار فقط" : "إجمالي الحجز كاملاً";
}

export function AdminBookingCouponModal({
  bookingId,
  appliedCouponCode,
  appliedCouponScope,
  disabled = false,
  disabledReason,
}: Props) {
  const router = useRouter();
  const [panelOpen, setPanelOpen] = useState(false);
  const [code, setCode] = useState("");
  const [preview, setPreview] = useState<AdminCouponPreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isPending, startTransition] = useTransition();

  function resetPanel() {
    setCode("");
    setPreview(null);
    setError(null);
  }

  function handlePreview() {
    if (!code.trim()) {
      setError("أدخل كود الخصم أولاً.");
      return;
    }
    setError(null);
    setPreview(null);
    startTransition(async () => {
      const res = await previewAdminCouponAction(bookingId, code);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setPreview(res);
    });
  }

  function handleConfirm() {
    setError(null);
    const formData = new FormData();
    formData.set("bookingRequestId", String(bookingId));
    formData.set("code", code);
    startTransition(async () => {
      const res = await applyAdminCouponAction(null, formData);
      if (!res.ok) {
        setError(res.error || "تعذّر تطبيق كود الخصم.");
        return;
      }
      setPanelOpen(false);
      resetPanel();
      setSuccess(true);
      router.refresh();
    });
  }

  if (appliedCouponCode) {
    return (
      <div className="rounded-xl border border-emerald-200/70 bg-emerald-50/60 p-3.5">
        <div className="flex items-center gap-2 text-sm font-black text-emerald-900">
          <BadgePercent className="h-4 w-4 shrink-0" />
          كود خصم مُطبَّق: {appliedCouponCode}
        </div>
        {appliedCouponScope ? (
          <p className="mt-1 text-xs font-medium text-emerald-800">
            النطاق: {scopeLabelAr(appliedCouponScope)}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-4">
      <div className="flex items-center justify-between gap-3">
        <h4 className="flex items-center gap-2 text-sm font-black text-on-surface">
          <Tag className="h-4 w-4 text-primary" />
          كود خصم
        </h4>
        {!disabled ? (
          <button
            type="button"
            onClick={() => {
              setPanelOpen((v) => !v);
              resetPanel();
              setSuccess(false);
            }}
            className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-on-primary transition-opacity hover:opacity-95"
          >
            {panelOpen ? "إخفاء" : "إضافة كود خصم"}
          </button>
        ) : null}
      </div>

      {disabled ? (
        <p className="mt-2 text-xs font-semibold text-on-surface-variant">
          {disabledReason || "لا يمكن تطبيق كود خصم على هذا الحجز."}
        </p>
      ) : null}

      {success ? (
        <div className="mt-3 flex items-center gap-2 rounded-lg bg-emerald-50 p-2.5 text-xs font-semibold text-emerald-900">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          تم تطبيق الكوبون وتحديث سعر الحجز.
        </div>
      ) : null}

      {panelOpen && !disabled ? (
        <div className="mt-3 space-y-3">
          <div className="flex gap-2">
            <input
              type="text"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setPreview(null);
              }}
              placeholder="أدخل كود الخصم"
              dir="ltr"
              className={`${INPUT_CLASS} text-center font-bold uppercase`}
            />
            <button
              type="button"
              disabled={isPending || !code.trim()}
              onClick={handlePreview}
              className="shrink-0 rounded-xl border border-primary/40 px-3.5 py-2 text-xs font-bold text-primary transition-colors hover:bg-primary/5 disabled:opacity-50"
            >
              {isPending && !preview ? <Loader2 className="h-4 w-4 animate-spin" /> : "معاينة الخصم"}
            </button>
          </div>

          {error ? (
            <div className="flex items-center gap-2 rounded-lg bg-error-container/50 p-2.5 text-xs font-semibold text-error">
              <AlertCircle className="h-4 w-4 shrink-0" />
              <span>{error}</span>
            </div>
          ) : null}

          {preview && preview.ok ? (
            <div className="space-y-2 rounded-lg bg-primary/5 p-3 text-sm">
              <div className="flex items-center justify-between text-xs font-semibold text-on-surface-variant">
                <span>الإجمالي الحالي</span>
                <span className="tabular-nums line-through opacity-70">
                  <SarAmountWithSymbol>{formatSarAmount(preview.currentTotalInclTax)}</SarAmountWithSymbol>
                </span>
              </div>
              <div className="flex items-center justify-between font-black text-primary">
                <span>الإجمالي بعد الخصم</span>
                <span className="tabular-nums">
                  <SarAmountWithSymbol bold>{formatSarAmount(preview.newTotalInclTax)}</SarAmountWithSymbol>
                </span>
              </div>
              <p className="text-xs font-semibold text-on-surface-variant">
                {preview.labelAr} — نطاق التطبيق: {scopeLabelAr(preview.scope)}
              </p>
              {preview.floorApplied ? (
                <p className="text-[11px] font-semibold text-amber-800">
                  تنبيه: الحد الأدنى للسعر قصّ جزءاً من الخصم.
                </p>
              ) : null}

              <button
                type="button"
                disabled={isPending}
                onClick={handleConfirm}
                className="mt-1 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary transition-opacity hover:opacity-95 disabled:opacity-70"
              >
                {isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <BadgePercent className="h-4 w-4" />}
                {isPending ? "جاري التطبيق..." : "تأكيد وتطبيق الخصم"}
              </button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
