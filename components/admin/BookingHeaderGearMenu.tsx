"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Settings,
  Pencil,
  Receipt,
  Printer,
  Mail,
  Key,
  ChevronDown,
  Loader2,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { adminSendStatementEmail } from "@/app/admin/(dashboard)/bookings/[id]/statement/statement-actions";

type Props = {
  bookingId: number;
  kind: string;
  currentPlateNumber?: string | null;
  onOpenPlateModal?: () => void;
  canEditBooking?: boolean;
};

export function BookingHeaderGearMenu({
  bookingId,
  kind,
  currentPlateNumber,
  onOpenPlateModal,
  canEditBooking = false,
}: Props) {
  const [open, setOpen] = useState(false);
  const [loadingEmail, setLoadingEmail] = useState(false);
  const [emailStatus, setEmailStatus] = useState<"idle" | "success" | "error">("idle");
  const [emailMessage, setEmailMessage] = useState("");

  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  const handleSendEmail = async () => {
    setLoadingEmail(true);
    setEmailStatus("idle");
    setEmailMessage("");
    try {
      const result = await adminSendStatementEmail(bookingId);
      if (result.ok) {
        setEmailStatus("success");
        setEmailMessage(`تم إرسال الكشف إلى: ${result.to}`);
        setTimeout(() => setOpen(false), 3000);
      } else {
        setEmailStatus("error");
        setEmailMessage(result.error);
      }
    } catch {
      setEmailStatus("error");
      setEmailMessage("حدث خطأ غير متوقع أثناء إرسال الكشف.");
    } finally {
      setLoadingEmail(false);
    }
  };

  return (
    <div className="relative inline-block text-right print:hidden" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/40 bg-white px-4 py-2 text-sm font-extrabold text-[#003749] shadow-xs transition-colors hover:bg-surface-container-low focus:outline-none focus:ring-2 focus:ring-primary/20"
      >
        <Settings className="size-4 text-primary animate-spin-slow" />
        <span>إجراءات الحجز</span>
        <ChevronDown className={`size-4 text-on-surface-variant transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          className="absolute left-0 top-full mt-2 w-64 rounded-2xl border border-outline-variant/30 bg-white p-1.5 shadow-2xl z-50 animate-in fade-in zoom-in-95 duration-150"
          onClick={(e) => {
            if (e.target instanceof Element && (e.target.closest("a") || e.target.closest("button"))) {
              if (!e.target.closest(".no-close")) {
                setOpen(false);
              }
            }
          }}
          dir="rtl"
        >
          {/* Edit Booking */}
          {canEditBooking ? (
            <Link
              href={`/admin/bookings/${bookingId}?edit=1`}
              className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-right text-xs font-bold text-on-surface transition-colors hover:bg-surface-container-low"
            >
              <Pencil className="size-4 text-primary" />
              تعديل بيانات الحجز
            </Link>
          ) : null}

          {kind === "DIRECT" ? (
            <>
              {/* Financials */}
              <Link
                href={`/admin/bookings/${bookingId}/finance`}
                className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-right text-xs font-bold text-[#003749] transition-colors hover:bg-surface-container-low"
              >
                <Receipt className="size-4 text-emerald-600" />
                العمليات المالية والحركات
              </Link>

              {/* Print Statement */}
              <Link
                href={`/admin/bookings/${bookingId}/statement`}
                className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-right text-xs font-bold text-on-surface transition-colors hover:bg-surface-container-low"
              >
                <Printer className="size-4 text-sky-600" />
                طباعة كشف الحجز (PDF)
              </Link>

              {/* Send Email */}
              <button
                type="button"
                onClick={handleSendEmail}
                disabled={loadingEmail}
                className="no-close flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-right text-xs font-bold text-on-surface transition-colors hover:bg-surface-container-low disabled:opacity-50"
              >
                {loadingEmail ? (
                  <Loader2 className="size-4 animate-spin text-primary" />
                ) : (
                  <Mail className="size-4 text-amber-600" />
                )}
                إرسال الفاتورة عبر البريد
              </button>

              {emailStatus !== "idle" && (
                <div
                  className={`mx-2 my-1 flex items-start gap-2 rounded-xl p-2.5 text-[11px] font-bold ${
                    emailStatus === "success"
                      ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                      : "bg-rose-50 text-rose-800 border border-rose-200"
                  }`}
                >
                  {emailStatus === "success" ? (
                    <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
                  ) : (
                    <XCircle className="mt-0.5 size-3.5 shrink-0" />
                  )}
                  <span className="leading-relaxed">{emailMessage}</span>
                </div>
              )}

              {/* Plate Edit Modal */}
              {onOpenPlateModal ? (
                <>
                  <div className="my-1 h-px bg-outline-variant/20 mx-2" />
                  <button
                    type="button"
                    onClick={onOpenPlateModal}
                    className="flex w-full items-center gap-2.5 rounded-xl px-3.5 py-2.5 text-right text-xs font-bold text-[#003749] transition-colors hover:bg-[#fffdf8]"
                  >
                    <Key className="size-4 text-[#dbb878]" />
                    {currentPlateNumber ? `تعديل رقم اللوحة (${currentPlateNumber})` : "ربط رقم لوحة السيارة"}
                  </button>
                </>
              ) : null}
            </>
          ) : null}
        </div>
      )}
    </div>
  );
}
