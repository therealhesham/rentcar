"use client";

import { useState, useTransition } from "react";
import { Check, X, Key, CornerDownLeft, Loader2, AlertCircle } from "lucide-react";
import { quickUpdateBookingStatus } from "@/app/admin/booking-request-actions";
import { recordReturnToBranchAction } from "@/app/admin/booking-lifecycle-actions";
import { VehiclePlateHandoverModal } from "@/components/admin/VehiclePlateHandoverModal";

type Props = {
  bookingId: number;
  status: string;
  kind: "INQUIRY" | "DIRECT";
  carModelId: number | null;
  currentPlateNumber?: string | null;
};

export function BookingListQuickActions({ bookingId, status, kind, carModelId, currentPlateNumber }: Props) {
  const [isPending, startTransition] = useTransition();
  const [handoverModalOpen, setHandoverModalOpen] = useState(false);

  const [modalConfig, setModalConfig] = useState<{
    open: boolean;
    type: "confirm" | "error";
    message: string;
    actionLabel?: string;
    onConfirm?: () => void;
  }>({ open: false, type: "confirm", message: "" });

  const handleAction = (newStatus: string) => {
    startTransition(async () => {
      let result;
      if (newStatus === "RETURNED") {
        const formData = new FormData();
        formData.append("bookingRequestId", String(bookingId));
        result = await recordReturnToBranchAction(null, formData);
      } else {
        result = await quickUpdateBookingStatus(bookingId, newStatus);
      }

      if (!result.ok) {
        // الإرجاع المتأخر يحتاج قرار غرامة — القرار وصلاحياته في صفحة الحجز، مش هنا.
        const needsLateDecision = "needsLateDecision" in result && result.needsLateDecision;
        setModalConfig({
          open: true,
          type: "error",
          message: needsLateDecision
            ? "السيارة أُرجعت متأخرة عن موعد الحجز. افتح صفحة الحجز لاتخاذ قرار غرامة التأخير قبل تسجيل الإرجاع."
            : "error" in result && typeof result.error === "string"
              ? result.error
              : "حدث خطأ أثناء تحديث الحالة",
        });
      }
    });
  };

  const confirmAction = (message: string, onConfirm: () => void, actionLabel = "تأكيد") => {
    setModalConfig({
      open: true,
      type: "confirm",
      message,
      actionLabel,
      onConfirm,
    });
  };

  const s = status.trim().toUpperCase();

  return (
    <>
      {isPending ? (
        <div className="flex items-center gap-1.5 px-2 py-1.5 text-xs text-on-surface-variant">
          <Loader2 className="size-3.5 animate-spin" />
          <span>جاري التحديث...</span>
        </div>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          {(s === "NEW" || s === "UNDER_REVIEW") && (
            <>
              {kind === "DIRECT" && carModelId ? (
                <button
                  type="button"
                  onClick={() => handleAction("CONFIRMED")}
                  className="inline-flex items-center gap-1 rounded-lg bg-emerald-100 px-2 py-1.5 text-[11px] font-bold text-emerald-800 transition-colors hover:bg-emerald-200"
                  title="تأكيد الحجز"
                >
                  <Check className="size-3.5 shrink-0" aria-hidden />
                  تأكيد
                </button>
              ) : null}
              <button
                type="button"
                onClick={() =>
                  confirmAction("هل أنت متأكد من رفض هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.", () =>
                    handleAction("REJECTED"), "رفض الطلب"
                  )
                }
                className="inline-flex items-center gap-1 rounded-lg bg-error-container/50 px-2 py-1.5 text-[11px] font-bold text-error transition-colors hover:bg-error-container"
                title="رفض الطلب"
              >
                <X className="size-3.5 shrink-0" aria-hidden />
                رفض
              </button>
            </>
          )}

          {s === "CONFIRMED" && (
            <button
              type="button"
              onClick={() => setHandoverModalOpen(true)}
              className="inline-flex items-center gap-1 rounded-lg bg-sky-100 px-2.5 py-1.5 text-[11px] font-bold text-sky-800 transition-colors hover:bg-sky-200"
            >
              <Key className="size-3.5 shrink-0" aria-hidden />
              تسليم السيارة للعميل
            </button>
          )}

          {s === "PICKED_UP" && (
            <button
              type="button"
              onClick={() =>
                confirmAction("هل تم استلام السيارة من العميل وإنهاء الحجز؟", () =>
                  handleAction("RETURNED"), "إرجاع واستلام السيارة"
                )
              }
              className="inline-flex items-center gap-1 rounded-lg bg-violet-100 px-2.5 py-1.5 text-[11px] font-bold text-violet-800 transition-colors hover:bg-violet-200"
            >
              <CornerDownLeft className="size-3.5 shrink-0" aria-hidden />
              تسليم إلى الفرع (إرجاع)
            </button>
          )}
        </div>
      )}

      {/* ─── Handover Modal Popup ──────────────────────────────────────── */}
      <VehiclePlateHandoverModal
        isOpen={handoverModalOpen}
        onClose={() => setHandoverModalOpen(false)}
        bookingId={bookingId}
        carModelId={carModelId}
        mode="HANDOVER"
        currentPlateNumber={currentPlateNumber}
      />

      {/* ─── Generic Confirm / Error Modal ────────────────────────────── */}
      {modalConfig.open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm cursor-default"
            onClick={() => setModalConfig({ ...modalConfig, open: false })}
          />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 editorial-shadow animate-in fade-in zoom-in-95 duration-200" dir="rtl">
            {modalConfig.type === "error" ? (
              <>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-full bg-error-container/50 p-2 text-error">
                    <AlertCircle className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-on-surface">حدث خطأ</h3>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      {modalConfig.message}
                    </p>
                  </div>
                </div>
                <div className="mt-5 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setModalConfig({ ...modalConfig, open: false })}
                    className="rounded-xl bg-surface-container-high px-4 py-2 text-sm font-bold text-on-surface hover:bg-surface-container-highest transition-colors"
                  >
                    إغلاق
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 rounded-full bg-primary-container/30 p-2 text-primary">
                    <AlertCircle className="size-5" />
                  </div>
                  <div>
                    <h3 className="text-base font-extrabold text-on-surface">تأكيد الإجراء</h3>
                    <p className="mt-1 text-sm text-on-surface-variant">
                      {modalConfig.message}
                    </p>
                  </div>
                </div>
                <div className="mt-6 flex flex-wrap items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setModalConfig({ ...modalConfig, open: false })}
                    className="rounded-xl px-4 py-2 text-sm font-bold text-on-surface-variant hover:bg-surface-container transition-colors"
                  >
                    تراجع
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModalConfig({ ...modalConfig, open: false });
                      modalConfig.onConfirm?.();
                    }}
                    className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:opacity-90 transition-opacity"
                  >
                    {modalConfig.actionLabel}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
