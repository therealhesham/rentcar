"use client";

import { CalendarClock, MapPin, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { OVERLAY_BACKDROP_Z } from "@/lib/overlay-z-index";

const GOLD = "#dbb878";
const GOLD_DARK = "#c9a356";
const TEAL = "#003749";

type Props = {
  open: boolean;
  branchOptions: { slug: string; name: string }[];
  initialBranch: string;
  initialPickup: string;
  initialDropoff: string;
  onConfirm: (draft: { branch: string; pickup: string; dropoff: string }) => void;
  onClose: () => void;
};

function localNowPlusHours(hours: number): string {
  const d = new Date(Date.now() + hours * 60 * 60 * 1000);
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
}

export function FleetBookNowHintModal({
  open,
  branchOptions,
  initialBranch,
  initialPickup,
  initialDropoff,
  onConfirm,
  onClose,
}: Props) {
  const fallbackBranch = branchOptions[0]?.slug ?? "";
  const [branch, setBranch] = useState(fallbackBranch);
  const [pickup, setPickup] = useState(localNowPlusHours(2));
  const [dropoff, setDropoff] = useState(localNowPlusHours(26));
  const [error, setError] = useState<string | null>(null);

  const hasBranches = branchOptions.length > 0;
  const branchValue = useMemo(
    () => (branch || initialBranch || fallbackBranch).trim(),
    [branch, initialBranch, fallbackBranch],
  );

  useEffect(() => {
    if (!open) return;
    setBranch((initialBranch || fallbackBranch).trim());
    setPickup((initialPickup || localNowPlusHours(2)).trim());
    setDropoff((initialDropoff || localNowPlusHours(26)).trim());
    setError(null);
  }, [open, initialBranch, initialPickup, initialDropoff, fallbackBranch]);

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

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);

    if (!hasBranches || !branchValue) {
      setError("يرجى اختيار فرع الاستلام.");
      return;
    }

    if (!pickup.trim() || !dropoff.trim()) {
      setError("يرجى تحديد تاريخ ووقت الاستلام والتسليم.");
      return;
    }

    const pickupDate = new Date(pickup);
    const dropoffDate = new Date(dropoff);
    if (Number.isNaN(pickupDate.getTime()) || Number.isNaN(dropoffDate.getTime())) {
      setError("صيغة التاريخ/الوقت غير صالحة.");
      return;
    }
    if (dropoffDate.getTime() < pickupDate.getTime()) {
      setError("وقت التسليم يجب أن يكون بعد وقت الاستلام.");
      return;
    }

    onConfirm({ branch: branchValue, pickup: pickup.trim(), dropoff: dropoff.trim() });
  }

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

      <div className="relative w-full max-w-[480px] overflow-hidden rounded-3xl bg-white shadow-[0_32px_80px_-24px_rgba(15,61,71,0.35)] ring-1 ring-black/[0.06]">
        <button
          type="button"
          onClick={onClose}
          className="absolute end-4 top-4 rounded-full p-1.5 text-[#aaa08e] transition-colors hover:bg-[#fdfbf6] hover:text-[#003749]"
          aria-label="إغلاق"
        >
          <X className="size-5" aria-hidden />
        </button>

        <div className="px-6 pb-6 pt-8 sm:px-8 sm:pb-8 sm:pt-10" dir="rtl">
          <div
            className="mx-auto mb-4 flex size-[4rem] items-center justify-center rounded-2xl shadow-inner"
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
            أكمل بيانات الحجز
          </h2>
          <p id="fleet-book-hint-desc" className="mt-2 text-[14px] font-medium leading-relaxed text-[#4b5563]">
            حدّد الفرع ووقت الاستلام والتسليم وسنكمل مباشرة إلى صفحة إتمام الحجز.
          </p>

          <form className="mt-5 space-y-3 text-start" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[#003749]/75">
                <MapPin className="size-3.5 text-[#dbb878]" aria-hidden />
                فرع الاستلام
              </span>
              <select
                value={branchValue}
                onChange={(e) => setBranch(e.target.value)}
                className="w-full rounded-xl border border-[#e8dfcb] bg-white px-3 py-2.5 text-[14px] font-semibold text-[#0f1923] outline-none transition focus:border-[#dbb878] focus:ring-2 focus:ring-[#dbb878]/25"
              >
                {branchOptions.map((b) => (
                  <option key={b.slug} value={b.slug}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[#003749]/75">
                <CalendarClock className="size-3.5 text-[#dbb878]" aria-hidden />
                الاستلام
              </span>
              <input
                type="datetime-local"
                value={pickup}
                onChange={(e) => setPickup(e.target.value)}
                className="w-full rounded-xl border border-[#e8dfcb] bg-white px-3 py-2.5 text-[14px] font-semibold text-[#0f1923] outline-none transition focus:border-[#dbb878] focus:ring-2 focus:ring-[#dbb878]/25"
                dir="ltr"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-[#003749]/75">
                <CalendarClock className="size-3.5 text-[#dbb878]" aria-hidden />
                التسليم
              </span>
              <input
                type="datetime-local"
                value={dropoff}
                onChange={(e) => setDropoff(e.target.value)}
                className="w-full rounded-xl border border-[#e8dfcb] bg-white px-3 py-2.5 text-[14px] font-semibold text-[#0f1923] outline-none transition focus:border-[#dbb878] focus:ring-2 focus:ring-[#dbb878]/25"
                dir="ltr"
              />
            </label>

            {error ? (
              <p className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-[12px] font-semibold text-red-700">
                {error}
              </p>
            ) : null}

            <div className="pt-2">
              <button
                type="submit"
                className="w-full rounded-2xl py-3.5 text-[15px] font-extrabold text-white shadow-[0_10px_28px_-10px_rgba(201,163,86,0.55)] transition-[transform,box-shadow] hover:-translate-y-0.5 active:translate-y-0"
                style={{
                  background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)`,
                }}
              >
                متابعة الحجز
              </button>
            </div>
          </form>

          <div className="mt-3 flex flex-col gap-3">
            <button
              type="button"
              onClick={onClose}
              className="w-full rounded-2xl border-2 border-[#003749]/18 bg-white py-3.5 text-[14px] font-extrabold text-[#003749] transition-colors hover:border-[#dbb878]/45 hover:bg-[#fdfbf6]"
            >
              إلغاء
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modal, document.body);
}
