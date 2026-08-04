"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { FileText, X, Mail, Phone, Trash2, Archive, MailOpen, AlertCircle } from "lucide-react";
import { deleteContactMessage, updateContactMessageStatus } from "./actions";
import {
  CONTACT_MESSAGE_STATUS_LABELS,
  type ContactMessageStatus,
} from "@/lib/contact-messages";

export type ContactMessageRow = {
  id: number;
  name: string;
  email: string;
  phone: string;
  subject: string;
  message: string;
  status: string;
  createdAt: string;
};

export function StatusBadge({ status }: { status: string }) {
  const label = CONTACT_MESSAGE_STATUS_LABELS[status as ContactMessageStatus] ?? status;
  const cls =
    status === "NEW"
      ? "bg-primary/10 text-primary border-primary/20"
      : status === "READ"
        ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
        : "bg-surface-container-highest text-on-surface-variant border-outline-variant/30";

  return (
    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold ${cls}`}>
      {label}
    </span>
  );
}

export function MessageActions({ row }: { row: ContactMessageRow }) {
  const [isOpen, setIsOpen] = useState(false);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const run = (fn: () => Promise<{ ok: boolean; error?: string }>, closeOnDone = false) => {
    setError("");
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) {
        setError(res.error || "حدث خطأ غير متوقع.");
        return;
      }
      if (closeOnDone) setIsOpen(false);
      router.refresh();
    });
  };

  const open = () => {
    setIsOpen(true);
    // فتح الرسالة يعتبرها مقروءة — من غير ما نمسح أرشفة سابقة.
    if (row.status === "NEW") {
      startTransition(async () => {
        await updateContactMessageStatus(row.id, "READ");
        router.refresh();
      });
    }
  };

  return (
    <>
      <button
        onClick={open}
        className="inline-flex items-center gap-2 font-medium text-primary hover:text-primary/90 transition-all bg-primary/5 hover:bg-primary/10 px-3 py-2 rounded-xl border border-primary/10 shadow-sm"
      >
        <FileText className="w-4 h-4" />
        <span className="text-xs">عرض الرسالة</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-2xl bg-surface rounded-3xl shadow-2xl border border-outline-variant/30 overflow-hidden animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-start justify-between gap-4 p-6 border-b border-outline-variant/20 bg-surface-container-low">
              <div className="min-w-0">
                <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="truncate">{row.subject}</span>
                </h3>
                <p className="mt-1 text-sm text-on-surface-variant">
                  من {row.name} — {row.createdAt}
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant hover:text-on-surface"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 max-h-[60vh] overflow-y-auto space-y-4">
              {error && (
                <div className="flex items-center gap-2 p-3 text-sm text-error bg-error/10 rounded-xl border border-error/20">
                  <AlertCircle className="w-5 h-5 flex-shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              <div className="flex flex-wrap gap-3">
                <a
                  href={`mailto:${encodeURIComponent(row.email)}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-primary/10 bg-primary/5 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                  dir="ltr"
                >
                  <Mail className="w-4 h-4" />
                  {row.email}
                </a>
                <a
                  href={`tel:${row.phone.replace(/\s/g, "")}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-primary/10 bg-primary/5 px-3 py-2 text-sm font-medium text-primary transition-colors hover:bg-primary/10"
                  dir="ltr"
                >
                  <Phone className="w-4 h-4 tabular-nums" />
                  {row.phone}
                </a>
              </div>

              <p className="text-on-surface-variant whitespace-pre-wrap leading-relaxed text-sm bg-surface-container-low p-4 rounded-2xl border border-outline-variant/10">
                {row.message}
              </p>
            </div>

            <div className="p-4 border-t border-outline-variant/20 bg-surface-container-low flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap gap-2">
                {row.status !== "ARCHIVED" ? (
                  <button
                    onClick={() => run(() => updateContactMessageStatus(row.id, "ARCHIVED"), true)}
                    disabled={isPending}
                    className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/30 px-4 py-2.5 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-50"
                  >
                    <Archive className="w-4 h-4" />
                    أرشفة
                  </button>
                ) : (
                  <button
                    onClick={() => run(() => updateContactMessageStatus(row.id, "READ"))}
                    disabled={isPending}
                    className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/30 px-4 py-2.5 text-sm font-semibold text-on-surface-variant transition-colors hover:bg-surface-container-high disabled:opacity-50"
                  >
                    <MailOpen className="w-4 h-4" />
                    إلغاء الأرشفة
                  </button>
                )}
                <button
                  onClick={() => {
                    if (!confirm("حذف الرسالة نهائياً؟")) return;
                    run(() => deleteContactMessage(row.id), true);
                  }}
                  disabled={isPending}
                  className="inline-flex items-center gap-2 rounded-xl border border-error/20 bg-error/5 px-4 py-2.5 text-sm font-semibold text-error transition-colors hover:bg-error/10 disabled:opacity-50"
                >
                  <Trash2 className="w-4 h-4" />
                  حذف
                </button>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="px-6 py-2.5 rounded-xl bg-primary text-on-primary font-medium hover:bg-primary/90 transition-colors shadow-sm"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
