"use client";

import { ScrollText, X } from "lucide-react";
import { useLocale } from "next-intl";
import { useEffect } from "react";
import type { RentalTermDTO } from "@/lib/rental-terms-data";

const TEAL = "#003749";

type Props = {
  open: boolean;
  onClose: () => void;
  terms: RentalTermDTO[];
  loading?: boolean;
};

export function RentalTermsModal({ open, onClose, terms, loading }: Props) {
  const locale = useLocale();
  const isEn = locale === "en";

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="rental-terms-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#0f1923]/45 backdrop-blur-[3px] transition-opacity"
        aria-label={isEn ? "Close" : "إغلاق"}
        onClick={onClose}
      />

      <div
        className="relative flex max-h-[85vh] w-full max-w-[640px] flex-col overflow-hidden rounded-3xl bg-white shadow-[0_32px_80px_-24px_rgba(15,61,71,0.35)] ring-1 ring-black/[0.06]"
        dir={isEn ? "ltr" : "rtl"}
      >
        <div className="flex items-center gap-3 border-b border-[#ebe4d3] px-6 py-5 sm:px-8">
          <div
            className="flex size-11 shrink-0 items-center justify-center rounded-2xl shadow-inner"
            style={{
              background: `linear-gradient(145deg, rgba(219,184,120,0.18) 0%, rgba(0,55,73,0.08) 100%)`,
              color: TEAL,
            }}
          >
            <ScrollText className="size-6" strokeWidth={1.75} aria-hidden />
          </div>
          <h2
            id="rental-terms-title"
            className="text-lg font-extrabold tracking-tight text-[#003749] sm:text-xl"
          >
            {isEn ? "Terms and Conditions" : "الشروط والأحكام"}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="ms-auto rounded-full p-1.5 text-[#aaa08e] transition-colors hover:bg-[#fdfbf6] hover:text-[#003749]"
            aria-label={isEn ? "Close" : "إغلاق"}
          >
            <X className="size-5" aria-hidden />
          </button>
        </div>

        <div className="overflow-y-auto px-6 py-6 sm:px-8">
          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-center">
              <div className="h-7 w-7 animate-spin rounded-full border-2 border-[#003749] border-t-transparent" />
              <p className="text-xs font-bold text-[#8a7752]">
                {isEn ? "Loading terms..." : "جاري تحميل الشروط والأحكام..."}
              </p>
            </div>
          ) : terms.length === 0 ? (
            <p className="text-center text-[14px] font-semibold text-[#aaa08e]">
              {isEn
                ? "Terms and conditions are not available at the moment."
                : "الشروط والأحكام غير متوفرة حالياً."}
            </p>
          ) : (
            <ol className="space-y-6">
              {terms.map((term, i) => (
                <li key={term.id}>
                  <h3 className="mb-2 flex items-baseline gap-2 text-[15px] font-extrabold text-[#003749]">
                    <span className="text-[#c9a356]">{i + 1}.</span>
                    {term.title}
                  </h3>
                  <p className="whitespace-pre-line text-[13.5px] font-medium leading-relaxed text-[#4b5563]">
                    {term.body}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
