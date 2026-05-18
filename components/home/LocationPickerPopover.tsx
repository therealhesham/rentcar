"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { MapPin, Building2, X, ChevronLeft } from "lucide-react";
import type { BookingCityBranchesOption } from "@/lib/booking-location-options";
import { useAnchoredPopoverPosition } from "@/lib/use-anchored-popover-position";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  dateCities: BookingCityBranchesOption[];
  selectedBranchSlug: string;
  defaultBranchSlug: string;
  onBranchSelect: (branchSlug: string, citySlug: string) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  label: string;
};

export function LocationPickerPopover({
  isOpen,
  onClose,
  dateCities,
  selectedBranchSlug,
  defaultBranchSlug,
  onBranchSelect,
  anchorRef,
  label,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [activeCitySlug, setActiveCitySlug] = useState(
    () => dateCities[0]?.slug ?? ""
  );

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handler(e: MouseEvent) {
      const anchor = anchorRef.current;
      const panel = panelRef.current;
      if (!panel) return;
      if (
        !panel.contains(e.target as Node) &&
        (!anchor || !anchor.contains(e.target as Node))
      ) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose, anchorRef]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  // Set active city when opening based on selected branch
  useEffect(() => {
    if (!isOpen) return;
    const effectiveBranch = selectedBranchSlug || defaultBranchSlug;
    const city = dateCities.find((c) =>
      c.branches.some((b) => b.slug === effectiveBranch)
    );
    if (city) setActiveCitySlug(city.slug);
    else if (dateCities.length > 0) setActiveCitySlug(dateCities[0]!.slug);
  }, [isOpen, selectedBranchSlug, defaultBranchSlug, dateCities]);

  const activeCity = dateCities.find((c) => c.slug === activeCitySlug);
  const effectiveBranch = selectedBranchSlug || defaultBranchSlug;

  const { style: panelStyle, ready: panelReady } = useAnchoredPopoverPosition(
    isOpen,
    anchorRef,
    panelRef,
    { panelWidth: 420 },
  );

  if (!isOpen || !panelReady || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`اختر ${label}`}
      style={panelStyle}
      className="location-popover overflow-hidden rounded-2xl border border-[#ebe4d3] bg-white shadow-[0_20px_60px_-10px_rgba(0,55,73,0.22),0_4px_16px_-4px_rgba(0,55,73,0.12)]"
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#f0ebe4] bg-gradient-to-l from-[#fdfbf6] to-[#f9f5ee] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-[#dbb878]/15">
            <MapPin className="size-3.5 text-[#dbb878]" />
          </span>
          <span className="text-[13px] font-bold text-[#003749]">اختر {label}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-7 items-center justify-center rounded-full text-[#8a7752] transition-colors hover:bg-[#f0ebe4] hover:text-[#003749]"
          aria-label="إغلاق"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="flex" style={{ minHeight: "200px" }}>
        {/* City tabs - right column */}
        <div className="w-[130px] shrink-0 border-l border-[#f0ebe4] bg-[#fdfbf6]">
          {dateCities.map((city) => {
            const isActive = city.slug === activeCitySlug;
            return (
              <button
                key={city.slug}
                type="button"
                onClick={() => setActiveCitySlug(city.slug)}
                className={`relative flex w-full items-center gap-2 px-3 py-2.5 text-right text-[12px] font-bold transition-all ${
                  isActive
                    ? "bg-white text-[#003749]"
                    : "text-[#8a7752] hover:bg-white/60 hover:text-[#003749]"
                }`}
              >
                {isActive && (
                  <span className="absolute inset-y-0 right-0 w-0.5 bg-gradient-to-b from-[#dbb878] to-[#c9a356] rounded-full" />
                )}
                <Building2 className={`size-3.5 shrink-0 ${isActive ? "text-[#dbb878]" : "text-[#c9a356]/60"}`} />
                <span className="truncate">{city.name}</span>
                {isActive && (
                  <ChevronLeft className="mr-auto size-3 shrink-0 text-[#dbb878]" />
                )}
              </button>
            );
          })}
        </div>

        {/* Branch list - left side */}
        <div className="flex-1 overflow-y-auto py-2" style={{ maxHeight: "280px" }}>
          {activeCity?.branches.length === 0 && (
            <p className="px-4 py-6 text-center text-[12px] text-[#aaa08e]">
              لا توجد فروع في هذه المدينة
            </p>
          )}
          {activeCity?.branches.map((branch) => {
            const isSelected = branch.slug === effectiveBranch;
            return (
              <button
                key={branch.slug}
                type="button"
                onClick={() => {
                  onBranchSelect(branch.slug, activeCitySlug);
                  onClose();
                }}
                className={`group flex w-full items-center gap-3 px-4 py-2.5 text-right transition-all ${
                  isSelected
                    ? "bg-[#dbb878]/10 text-[#003749]"
                    : "text-[#3a2f1e] hover:bg-[#fdfbf6]"
                }`}
              >
                <span
                  className={`flex size-5 shrink-0 items-center justify-center rounded-full border transition-all ${
                    isSelected
                      ? "border-[#dbb878] bg-[#dbb878]"
                      : "border-[#dbb878]/40 group-hover:border-[#dbb878]/70"
                  }`}
                >
                  {isSelected && (
                    <span className="size-2 rounded-full bg-white" />
                  )}
                </span>
                <span className="text-[13px] font-semibold">{branch.name}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>,
    document.body,
  );
}
