"use client";

import { CalendarClock, X } from "lucide-react";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { OVERLAY_BACKDROP_Z } from "@/lib/overlay-z-index";

const GOLD = "#dbb878";
const GOLD_DARK = "#c9a356";
const TEAL = "#003749";

type Props = {
  open: boolean;
  message: string;
  onClose: () => void;
  onGoToSearch: () => void;
};

export function FleetBookNowHintModal({ open, message, onClose, onGoToSearch }: Props) {
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open || typeof document === "undefined") return null;

  const modal = (
    <div
      className="fixed inset-0 flex items-center justify-center p-4 sm:p-6"
      style={{ zIndex: OVERLAY_BACKDROP_Z }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="fleet-book-hint-title"
      aria-describedby="fleet-book-hint-desc"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#0f1923]/45 backdrop-blur-[3px] transition-opacity"
        aria-label="إغلاق"
        onClick={onClose}
      />

      <div className="relative w-full max-w-[440px] overflow-hidden rounded-3xl bg-white shadow-[0_32px_80px_-24px_rgba(15,61,71,0.35)] ring-1 ring-black/[0.06]">
        <button
          type="button"
          onClick={onClose}
          className="absolute end-4 top-4 rounded-full p-1.5 text-[#aaa08e] transition-colors hover:bg-[#fdfbf6] hover:text-[#003749]"
          aria-label="إغلاق"
        >
          <X className="size-5" aria-hidden />
        </button>

        <div className="px-8 pb-8 pt-10 text-center" dir="rtl">
          <div
            className="mx-auto mb-5 flex size-[4.25rem] items-center justify-center rounded-2xl shadow-inner"
            style={{
              background: `linear-gradient(145deg, rgba(219,184,120,0.22) 0%, rgba(0,55,73,0.08) 100%)`,
              color: TEAL,
            }}
          >
            <CalendarClock className="size-9" strokeWidth={1.75} aria-hidden />
          </div>

          <h2
            id="fleet-book-hint-title"
            className="text-[1.35rem] font-extrabold tracking-tight text-[#003749] sm:text-2xl"
          >
            أكمل بيانات البحث أولاً
          </h2>
          <p
            id="fleet-book-hint-desc"
            className="mt-4 text-[15px] font-medium leading-relaxed text-[#4b5563]"
          >
            {message}
          </p>

          <ul className="mt-5 space-y-2 rounded-2xl border border-[#ebe4d3]/80 bg-[#fdfbf6] px-4 py-3.5 text-start text-[13px] font-semibold leading-relaxed text-[#6b5a3b]">
            <li className="flex gap-2">
              <span className="mt-0.5 shrink-0 font-extrabold text-[#dbb878]" aria-hidden>
                1
              </span>
              <span>اختر موقع الاستلام (فرع أو توصيل)</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 shrink-0 font-extrabold text-[#dbb878]" aria-hidden>
                2
              </span>
              <span>حدّد تاريخ ووقت الاستلام والتسليم</span>
            </li>
            <li className="flex gap-2">
              <span className="mt-0.5 shrink-0 font-extrabold text-[#dbb878]" aria-hidden>
                3
              </span>
              <span>اضغط «ابحث عن السيارات» ثم «احجز الآن»</span>
            </li>
          </ul>

          <div className="mt-8 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                onGoToSearch();
                onClose();
              }}
              className="w-full rounded-2xl py-3.5 text-[15px] font-extrabold text-white shadow-[0_10px_28px_-10px_rgba(201,163,86,0.55)] transition-[transform,box-shadow] hover:-translate-y-0.5 active:translate-y-0"
              style={{
                background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)`,
              }}
            >
              الذهاب لنموذج البحث
            </button>
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-2xl border-2 border-[#003749]/18 bg-white py-3.5 text-[14px] font-extrabold text-[#003749] transition-colors hover:border-[#dbb878]/45 hover:bg-[#fdfbf6]"
            >
              حسناً
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
