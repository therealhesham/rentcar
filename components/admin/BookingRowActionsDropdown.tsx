"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import Link from "next/link";
import {
  MoreVertical,
  Pencil,
  CreditCard,
  Check,
  X,
  Key,
  CornerDownLeft,
  ArrowLeft,
  Loader2,
  AlertCircle,
} from "lucide-react";
import { AdminQuickPaymentModalInner } from "./AdminQuickPaymentModal";
import { EditBookingModalInner, type EditableBookingRow } from "./EditBookingRequestForm";
import { quickUpdateBookingStatus } from "@/app/admin/booking-request-actions";

type CategoryOption = { slug: string; title: string };
type BookableModelOption = { id: number; label: string };

type Props = {
  request: EditableBookingRow;
  paymentStatus: string | null;
  categories: CategoryOption[];
  models: BookableModelOption[];
  isMobile?: boolean;
};

export function BookingRowActionsDropdown({ request, paymentStatus, categories, models, isMobile }: Props) {
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);

  const [isPending, startTransition] = useTransition();
  const [modalConfig, setModalConfig] = useState<{
    open: boolean;
    type: "confirm" | "error";
    message: string;
    actionLabel?: string;
    onConfirm?: () => void;
  }>({ open: false, type: "confirm", message: "" });

  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleAction = (newStatus: string) => {
    startTransition(async () => {
      const result = await quickUpdateBookingStatus(request.id, newStatus);
      if (!result.ok) {
        setModalConfig({
          open: true,
          type: "error",
          message: result.error || "حدث خطأ أثناء تحديث الحالة",
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

  const status = request.status.trim().toUpperCase();
  const ps = paymentStatus?.trim().toUpperCase();
  const showPayment = ps !== "PAID";

  return (
    <>
      <div className="relative inline-block text-right" ref={ref}>
        <button
          type="button"
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="p-1.5 rounded-lg hover:bg-surface-container-high text-on-surface-variant transition-colors"
          title="الإجراءات"
        >
          <MoreVertical className="size-5" />
        </button>

        {dropdownOpen && (
          <div
            className={`absolute z-40 mt-1 min-w-[200px] flex flex-col rounded-xl border border-outline-variant/40 bg-surface-container-lowest p-1 shadow-lg
              ${isMobile ? "bottom-full mb-1 right-0" : "top-full mt-1 left-0"}
            `}
            onClick={(e) => {
              if (e.target instanceof Element && (e.target.closest("button") || e.target.closest("a"))) {
                setDropdownOpen(false);
              }
            }}
          >
            {isPending && (
              <div className="flex items-center gap-2 px-3 py-2 text-xs font-bold text-primary">
                <Loader2 className="size-3.5 animate-spin" />
                جاري التحديث...
              </div>
            )}

            {!isPending && (
              <>
                <Link
                  href={`/admin/bookings/${request.id}`}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-xs font-bold text-on-surface hover:bg-surface-container-low transition-colors"
                >
                  <ArrowLeft className="size-3.5 text-on-surface-variant" />
                  التفاصيل المكتملة
                </Link>

                <button
                  type="button"
                  onClick={() => setEditModalOpen(true)}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-xs font-bold text-on-surface hover:bg-surface-container-low transition-colors"
                >
                  <Pencil className="size-3.5 text-on-surface-variant" />
                  تعديل الحجز
                </button>

                {showPayment && (
                  <button
                    type="button"
                    onClick={() => setPaymentModalOpen(true)}
                    className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-xs font-bold text-amber-900 hover:bg-amber-100 transition-colors"
                  >
                    <CreditCard className="size-3.5 text-amber-700" />
                    دفع
                  </button>
                )}

                {(status === "NEW" || status === "UNDER_REVIEW") && (
                  <>
                    <div className="my-1 h-px bg-outline-variant/20 mx-2" />
                    {request.kind === "DIRECT" && request.carModelId ? (
                      <button
                        type="button"
                        onClick={() => handleAction("CONFIRMED")}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-xs font-bold text-emerald-800 hover:bg-emerald-100 transition-colors"
                      >
                        <Check className="size-3.5 text-emerald-600" />
                        تأكيد الحجز
                      </button>
                    ) : null}
                    <button
                      type="button"
                      onClick={() =>
                        confirmAction("هل أنت متأكد من رفض هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء.", () =>
                          handleAction("REJECTED"), "رفض الطلب"
                        )
                      }
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-xs font-bold text-error hover:bg-error-container/50 transition-colors"
                    >
                      <X className="size-3.5" />
                      رفض الطلب
                    </button>
                  </>
                )}

                {status === "CONFIRMED" && (
                  <>
                    <div className="my-1 h-px bg-outline-variant/20 mx-2" />
                    <button
                      type="button"
                      onClick={() =>
                        confirmAction("هل تم تسليم السيارة للعميل بالفعل؟", () =>
                          handleAction("PICKED_UP"), "تسليم السيارة"
                        )
                      }
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-xs font-bold text-sky-800 hover:bg-sky-100 transition-colors"
                    >
                      <Key className="size-3.5 text-sky-600" />
                      تم تسليم السيارة
                    </button>
                  </>
                )}

                {status === "PICKED_UP" && (
                  <>
                    <div className="my-1 h-px bg-outline-variant/20 mx-2" />
                    <button
                      type="button"
                      onClick={() =>
                        confirmAction("هل تم استلام السيارة من العميل وإنهاء الحجز؟", () =>
                          handleAction("RETURNED"), "إنهاء الحجز"
                        )
                      }
                      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-start text-xs font-bold text-violet-800 hover:bg-violet-100 transition-colors"
                    >
                      <CornerDownLeft className="size-3.5 text-violet-600" />
                      استلام السيارة من العميل
                    </button>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {editModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
          <EditBookingModalInner
            request={request}
            categories={categories}
            models={models}
            onClose={() => setEditModalOpen(false)}
          />
        </div>
      )}

      {paymentModalOpen && (
        <AdminQuickPaymentModalInner
          bookingId={request.id}
          onClose={() => setPaymentModalOpen(false)}
        />
      )}

      {modalConfig.open && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4">
          <button
            type="button"
            className="absolute inset-0 bg-inverse-surface/40 backdrop-blur-sm cursor-default"
            onClick={() => setModalConfig({ ...modalConfig, open: false })}
          />
          <div className="relative z-10 w-full max-w-sm rounded-2xl border border-outline-variant/40 bg-surface-container-lowest p-5 editorial-shadow animate-in fade-in zoom-in-95 duration-200">
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
