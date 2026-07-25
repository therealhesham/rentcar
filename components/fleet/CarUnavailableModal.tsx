"use client";

import { CalendarOff, MapPinOff, X } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { useLocale } from "next-intl";

const GOLD = "#dbb878";
const GOLD_DARK = "#c9a356";
const TEAL = "#003749";

type Props = {
  open: boolean;
  onClose: () => void;
  onChangeDates: () => void;
  fleetUnits?: number;
};

export function CarUnavailableModal({ open, onClose, onChangeDates, fleetUnits }: Props) {
  const locale = useLocale();
  const isRTL = locale === "ar";

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  const isNoFleet = fleetUnits === 0;

  const title = isNoFleet
    ? isRTL ? "غير متوفرة بالفرع" : "Unavailable at Branch"
    : isRTL ? "غير متاح" : "Unavailable";

  const message = isNoFleet
    ? isRTL ? "هذه السيارة غير متوفرة في الفرع المختار." : "This vehicle is not available at the selected branch."
    : isRTL ? "خلال هذه الفترة (جميع السيارات محجوزة)" : "For these dates (fully booked)";

  const primaryBtnText = isNoFleet
    ? isRTL ? "تغيير الفرع / البيانات" : "Change Branch / Dates"
    : isRTL ? "اختيار تواريخ أخرى" : "Choose Other Dates";

  const secondaryBtnText = isRTL ? "تصفح الأسطول" : "Browse Fleet";
  const closeLabel = isRTL ? "إغلاق" : "Close";

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center p-4 sm:p-6"
      role="dialog"
      aria-modal="true"
      aria-labelledby="car-unavailable-title"
    >
      <button
        type="button"
        className="absolute inset-0 bg-[#0f1923]/45 backdrop-blur-[3px] transition-opacity"
        aria-label={closeLabel}
        onClick={onClose}
      />

      <div className="relative w-full max-w-[420px] overflow-hidden rounded-3xl bg-white shadow-[0_32px_80px_-24px_rgba(15,61,71,0.35)] ring-1 ring-black/[0.06]">
        <button
          type="button"
          onClick={onClose}
          className="absolute end-4 top-4 rounded-full p-1.5 text-[#aaa08e] transition-colors hover:bg-[#fdfbf6] hover:text-[#003749]"
          aria-label={closeLabel}
        >
          <X className="size-5" aria-hidden />
        </button>

        <div className="px-8 pb-8 pt-10 text-center" dir={isRTL ? "rtl" : "ltr"}>
          <div
            className="mx-auto mb-5 flex size-[4.25rem] items-center justify-center rounded-2xl shadow-inner"
            style={{
              background: `linear-gradient(145deg, rgba(219,184,120,0.18) 0%, rgba(0,55,73,0.08) 100%)`,
              color: TEAL,
            }}
          >
            {isNoFleet ? (
              <MapPinOff className="size-9" strokeWidth={1.75} aria-hidden />
            ) : (
              <CalendarOff className="size-9" strokeWidth={1.75} aria-hidden />
            )}
          </div>

          <h2 id="car-unavailable-title" className="text-[1.35rem] font-extrabold tracking-tight text-[#003749] sm:text-2xl">
            {title}
          </h2>
          <p className="mt-2 text-[15px] font-medium leading-relaxed text-[#6b7280]">
            {message}
          </p>

          <div className="mt-8 flex flex-col gap-3">
            <button
              type="button"
              onClick={() => {
                onChangeDates();
                onClose();
              }}
              className="w-full rounded-2xl py-3.5 text-[15px] font-extrabold text-white shadow-[0_10px_28px_-10px_rgba(201,163,86,0.55)] transition-[transform,box-shadow] hover:-translate-y-0.5 active:translate-y-0"
              style={{
                background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)`,
              }}
            >
              {primaryBtnText}
            </button>
            <Link
              href="/fleet"
              onClick={onClose}
              className="w-full rounded-2xl border-2 border-[#003749]/18 bg-white py-3.5 text-center text-[14px] font-extrabold text-[#003749] transition-colors hover:border-[#dbb878]/45 hover:bg-[#fdfbf6]"
            >
              {secondaryBtnText}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
