"use client";

import { useState } from "react";
import { FileText, X } from "lucide-react";

export function DetailsModal({ details }: { details: string | null }) {
  const [isOpen, setIsOpen] = useState(false);

  if (!details) {
    return <span className="text-on-surface-variant/50 italic text-xs">لا توجد تفاصيل إضافية</span>;
  }

  return (
    <>
      <button
        onClick={() => setIsOpen(true)}
        className="inline-flex items-center gap-2 font-medium text-primary hover:text-primary/90 transition-all bg-primary/5 hover:bg-primary/10 px-3 py-2 rounded-xl border border-primary/10 shadow-sm"
      >
        <FileText className="w-4 h-4" />
        <span className="text-xs"> التفاصيل</span>
      </button>

      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-lg bg-surface rounded-3xl shadow-2xl border border-outline-variant/30 overflow-hidden animate-in zoom-in-95 duration-200"
            role="dialog"
            aria-modal="true"
          >
            <div className="flex items-center justify-between p-6 border-b border-outline-variant/20 bg-surface-container-low">
              <h3 className="text-lg font-bold text-on-surface flex items-center gap-2">
                <FileText className="w-5 h-5 text-primary" />
                تفاصيل الطلب
              </h3>
              <button
                onClick={() => setIsOpen(false)}
                className="p-2 rounded-full hover:bg-surface-container-high transition-colors text-on-surface-variant hover:text-on-surface"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 max-h-[60vh] overflow-y-auto">
              <p className="text-on-surface-variant whitespace-pre-wrap leading-relaxed text-sm bg-surface-container-low p-4 rounded-2xl border border-outline-variant/10">
                {details}
              </p>
            </div>
            <div className="p-4 border-t border-outline-variant/20 bg-surface-container-low flex justify-end">
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
