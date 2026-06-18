"use client";

import { Printer, ChevronDown, Mail, Loader2, CheckCircle2, XCircle } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import { adminSendStatementEmail } from "./statement-actions";

type Props = {
  bookingId: number;
};

export function StatementActionsDropdown({ bookingId }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdown when clicking outside
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
    setLoading(true);
    setStatus("idle");
    setMessage("");
    try {
      const result = await adminSendStatementEmail(bookingId);
      if (result.ok) {
        setStatus("success");
        setMessage(`تم إرسال الكشف إلى: ${result.to}`);
        // keep open to show success for a bit
        setTimeout(() => setOpen(false), 3000);
      } else {
        setStatus("error");
        setMessage(result.error);
      }
    } catch (e) {
      setStatus("error");
      setMessage("حدث خطأ غير متوقع أثناء الإرسال.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative inline-flex items-center rounded-xl bg-primary shadow-sm print:hidden" ref={menuRef}>
      {/* Primary Print Button */}
      <button
        onClick={() => window.print()}
        className="inline-flex items-center gap-2 rounded-s-xl px-4 py-2 text-sm font-bold text-on-primary transition-colors hover:bg-white/20"
      >
        <Printer className="size-4" aria-hidden />
        طباعة الكشف
      </button>

      {/* Divider */}
      <div className="w-[1px] self-stretch bg-white/20" />

      {/* Dropdown Toggle */}
      <button
        onClick={() => setOpen(!open)}
        className="inline-flex items-center justify-center rounded-e-xl px-2 py-2 text-on-primary transition-colors hover:bg-white/20"
        aria-label="إجراءات إضافية"
      >
        <ChevronDown className="size-4" aria-hidden />
      </button>

      {/* Dropdown Menu */}
      {open && (
        <div className="absolute left-0 top-full mt-2 w-72 rounded-xl border border-outline-variant/30 bg-surface-container-lowest p-1.5 shadow-xl z-50">
          <button
            onClick={handleSendEmail}
            disabled={loading}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2.5 text-right text-sm font-bold text-on-surface transition-colors hover:bg-surface-container disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="size-4 animate-spin text-primary" />
            ) : (
              <Mail className="size-4 text-on-surface-variant" />
            )}
            إرسال الفاتورة عبر البريد (PDF)
          </button>
          
          {status !== "idle" && (
            <div className={`mt-1.5 flex items-start gap-2 rounded-lg p-2.5 text-xs font-bold ${
              status === "success" ? "bg-emerald-50 text-emerald-800 border border-emerald-200" : "bg-rose-50 text-rose-800 border border-rose-200"
            }`}>
              {status === "success" ? (
                <CheckCircle2 className="mt-0.5 size-3.5 shrink-0" />
              ) : (
                <XCircle className="mt-0.5 size-3.5 shrink-0" />
              )}
              <span className="leading-relaxed">{message}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
