"use client";

import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X, Info, CheckCircle2 } from "lucide-react";
import { OVERLAY_BACKDROP_Z } from "@/lib/overlay-z-index";

const TEAL = "#003749";
const GOLD = "#dbb878";
const GOLD_DARK = "#c9a356";

type Props = {
  open: boolean;
  carName: string;
  onConfirm: () => void;
  onClose: () => void;
};

const POINTS = [
  {
    icon: CheckCircle2,
    title: "نفس الفئة مضمونة",
    desc: "ستحصل على سيارة بنفس حجم وفئة السيارة التي اخترتها تماماً.",
  },
  {
    icon: CheckCircle2,
    title: "مواصفات مماثلة",
    desc: "عدد المقاعد، مساحة الشنطة، وناقل الحركة ستكون متطابقة أو أفضل.",
  },
  {
    icon: Info,
    title: "لماذا؟",
    desc: "لضمان توفر السيارة دائماً، نحتفظ بحق تقديم موديل مشابه عند الضرورة وفق معايير ACRISS العالمية.",
  },
];

export function OrSimilarModal({ open, carName, onConfirm, onClose }: Props) {
  /* قفل التمرير */
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  /* إغلاق بـ Escape */
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
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
      aria-labelledby="or-similar-title"
    >
      {/* Backdrop */}
      <button
        type="button"
        className="absolute inset-0 bg-[#0f1923]/50 backdrop-blur-[4px] transition-opacity"
        aria-label="إغلاق"
        onClick={onClose}
      />

      {/* البطاقة */}
      <div
        className="relative w-full max-w-[440px] overflow-hidden rounded-3xl bg-white shadow-[0_32px_80px_-20px_rgba(15,61,71,0.4)] ring-1 ring-black/[0.06]"
        dir="rtl"
      >
        {/* زر الإغلاق */}
        <button
          type="button"
          onClick={onClose}
          className="absolute end-4 top-4 z-10 rounded-full bg-white/80 p-1.5 text-gray-400 backdrop-blur-sm transition-colors hover:bg-gray-100 hover:text-gray-700"
          aria-label="إغلاق"
        >
          <X className="size-5" aria-hidden />
        </button>

        {/* الهيدر الملون */}
        <div
          className="relative flex flex-col items-center px-6 pb-6 pt-8 text-center"
          style={{
            background: `linear-gradient(160deg, ${TEAL} 0%, #004f6b 100%)`,
          }}
        >
          {/* أيقونة مركزية */}
          <div
            className="mb-4 flex size-16 items-center justify-center rounded-2xl"
            style={{ background: "rgba(219,184,120,0.18)" }}
          >
            <svg
              viewBox="0 0 48 48"
              fill="none"
              className="size-9"
              aria-hidden
            >
              {/* سيارة بسيطة */}
              <rect x="6" y="20" width="36" height="16" rx="4" stroke={GOLD} strokeWidth="2.5" />
              <path d="M10 20l5-8h18l5 8" stroke={GOLD} strokeWidth="2.5" strokeLinejoin="round" />
              <circle cx="14" cy="36" r="4" fill={GOLD} />
              <circle cx="34" cy="36" r="4" fill={GOLD} />
              {/* سهم تبادل */}
              <path d="M20 10h8M24 7l4 3-4 3" stroke={GOLD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>

          <h2
            id="or-similar-title"
            className="text-[1.25rem] font-extrabold tracking-tight text-white sm:text-[1.35rem]"
          >
            {carName}
          </h2>
          <p className="mt-1 text-[14px] font-semibold" style={{ color: GOLD }}>
            أو مشابهة
          </p>
          <p className="mt-2 text-[13px] leading-relaxed text-white/75">
            السيارة المعروضة مثال على الفئة التي ستحجزها
          </p>
        </div>

        {/* النقاط التوضيحية */}
        <div className="divide-y divide-gray-100 px-6">
          {POINTS.map((pt, i) => (
            <div key={i} className="flex gap-3 py-3.5">
              <pt.icon
                className="mt-0.5 size-4 shrink-0"
                style={{ color: i < 2 ? "#16a34a" : GOLD_DARK }}
                strokeWidth={2}
                aria-hidden
              />
              <div className="min-w-0">
                <p className="text-[13px] font-bold text-gray-800">{pt.title}</p>
                <p className="mt-0.5 text-[12px] leading-relaxed text-gray-500">{pt.desc}</p>
              </div>
            </div>
          ))}
        </div>

        {/* الأزرار */}
        <div className="flex flex-col gap-2.5 px-6 pb-6 pt-3">
          <button
            type="button"
            onClick={onConfirm}
            className="w-full rounded-2xl py-3.5 text-[15px] font-extrabold text-white shadow-[0_8px_24px_-8px_rgba(201,163,86,0.6)] transition-[transform,box-shadow] hover:-translate-y-0.5 active:translate-y-0"
            style={{ background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)` }}
          >
            فهمت، أكمل الحجز
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-2xl border-2 border-gray-200 bg-white py-3.5 text-[14px] font-bold text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50"
          >
            إلغاء
          </button>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
