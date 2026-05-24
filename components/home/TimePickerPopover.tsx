"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Clock, X } from "lucide-react";
import { useAnchoredPopoverPosition } from "@/lib/use-anchored-popover-position";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  label: string;
  time: string;
  onConfirm: (time: string) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  readOnly?: boolean;
};

const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (const m of [0, 15, 30, 45]) {
    TIME_OPTIONS.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}

export function TimePickerPopover({
  isOpen,
  onClose,
  label,
  time,
  onConfirm,
  anchorRef,
  readOnly = false,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const timeListRef = useRef<HTMLDivElement>(null);
  const [selectedTime, setSelectedTime] = useState(time || "09:00");

  useEffect(() => {
    if (!isOpen) return;
    setSelectedTime(time || "09:00");
  }, [isOpen, time]);

  useEffect(() => {
    if (!isOpen || !timeListRef.current) return;
    const active = timeListRef.current.querySelector("[data-active='true']") as HTMLElement | null;
    if (active) active.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [isOpen, selectedTime]);

  useEffect(() => {
    if (!isOpen) return;
    function handler(e: MouseEvent) {
      const panel = panelRef.current;
      const anchor = anchorRef.current;
      if (!panel) return;
      if (!panel.contains(e.target as Node) && (!anchor || !anchor.contains(e.target as Node))) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose, anchorRef]);

  useEffect(() => {
    if (!isOpen) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  function handleSelect(t: string) {
    if (readOnly) return;
    setSelectedTime(t);
    onConfirm(t);
    onClose();
  }

  const { style: panelStyle, ready: panelReady } = useAnchoredPopoverPosition(
    isOpen,
    anchorRef,
    panelRef,
    { panelWidth: 140 },
  );

  if (!isOpen || !panelReady || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`اختر ${label}`}
      style={panelStyle}
      className="datetime-popover flex flex-col overflow-hidden rounded-2xl border border-[#ebe4d3] bg-white shadow-[0_20px_60px_-10px_rgba(0,55,73,0.22),0_4px_16px_-4px_rgba(0,55,73,0.12)]"
      dir="rtl"
    >
      <div className="flex items-center justify-between border-b border-[#f0ebe4] bg-gradient-to-l from-[#fdfbf6] to-[#f9f5ee] px-3 py-2.5">
        <div className="flex items-center gap-2">
          <Clock className="size-3.5 text-[#dbb878]" />
          <span className="text-[12px] font-bold text-[#003749]">{label}</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="flex size-6 items-center justify-center rounded-full text-[#8a7752] transition-colors hover:bg-[#f0ebe4]"
          aria-label="إغلاق"
        >
          <X className="size-3.5" />
        </button>
      </div>
      {readOnly ? (
        <p className="px-3 py-4 text-center text-[11px] font-semibold text-[#aaa08e]">الوقت محدد آلياً</p>
      ) : (
        <div ref={timeListRef} className="max-h-[240px] overflow-y-auto py-1">
          {TIME_OPTIONS.map((t) => {
            const isActive = t === selectedTime;
            return (
              <button
                key={t}
                type="button"
                data-active={isActive}
                onClick={() => handleSelect(t)}
                className={`flex w-full items-center justify-center py-2 text-[12px] font-semibold tabular-nums transition-all
                  ${
                    isActive
                      ? "bg-gradient-to-r from-[#dbb878] to-[#c9a356] text-white"
                      : "text-[#3a2f1e] hover:bg-[#fdfbf6]"
                  }`}
              >
                {t}
              </button>
            );
          })}
        </div>
      )}
    </div>,
    document.body,
  );
}
