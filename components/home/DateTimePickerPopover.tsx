"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Calendar, Clock, X, ChevronRight, ChevronLeft } from "lucide-react";
import { useAnchoredPopoverPosition } from "@/lib/use-anchored-popover-position";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  label: string;
  dateDdMmYy: string; // "dd/mm/yyyy"
  time: string; // "HH:MM"
  minDateYmd?: string; // "yyyy-mm-dd"
  onConfirm: (dateDdMmYy: string, time: string) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  timeReadOnly?: boolean;
};

const MONTHS_AR = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];
const DAYS_AR = ["ح","ن","ث","ر","خ","ج","س"];

function ymdToDate(ymd: string): Date | null {
  if (!ymd || ymd.length < 10) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function ddMmYyToYmd(ddmmyy: string): string {
  const parts = ddmmyy.split("/");
  if (parts.length !== 3) return "";
  const [d, m, y] = parts;
  return `${y}-${m?.padStart(2,"0")}-${d?.padStart(2,"0")}`;
}

function ymdToDdMmYy(ymd: string): string {
  if (!ymd || ymd.length < 10) return "";
  const [y, m, d] = ymd.split("-");
  return `${d}/${m}/${y}`;
}

function todayYmd(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,"0")}-${String(t.getDate()).padStart(2,"0")}`;
}

const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (const m of [0, 30]) {
    TIME_OPTIONS.push(`${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}`);
  }
}

export function DateTimePickerPopover({
  isOpen,
  onClose,
  label,
  dateDdMmYy,
  time,
  minDateYmd,
  onConfirm,
  anchorRef,
  timeReadOnly = false,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const timeListRef = useRef<HTMLDivElement>(null);

  // Derive initial calendar year/month from current value or today
  const initialYmd = dateDdMmYy ? ddMmYyToYmd(dateDdMmYy) : (minDateYmd || todayYmd());
  const initialDate = ymdToDate(initialYmd) || new Date();

  const [calYear, setCalYear] = useState(initialDate.getFullYear());
  const [calMonth, setCalMonth] = useState(initialDate.getMonth()); // 0-indexed
  const [selectedYmd, setSelectedYmd] = useState(initialYmd);
  const [selectedTime, setSelectedTime] = useState(time || "09:00");

  // Sync state when opening
  useEffect(() => {
    if (!isOpen) return;
    const ymd = dateDdMmYy ? ddMmYyToYmd(dateDdMmYy) : (minDateYmd || todayYmd());
    const d = ymdToDate(ymd) || new Date();
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
    setSelectedYmd(ymd);
    setSelectedTime(time || "09:00");
  }, [isOpen, dateDdMmYy, time, minDateYmd]);

  // Scroll active time into view
  useEffect(() => {
    if (!isOpen || !timeListRef.current) return;
    const active = timeListRef.current.querySelector("[data-active='true']") as HTMLElement | null;
    if (active) {
      active.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [isOpen, selectedTime]);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    function handler(e: MouseEvent) {
      const panel = panelRef.current;
      const anchor = anchorRef.current;
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

  function buildCalendarDays(): Array<{ ymd: string; day: number; currMonth: boolean; disabled: boolean }> {
    const firstDay = new Date(calYear, calMonth, 1).getDay(); // 0=Sun
    // Adjust so week starts Sunday (index 0)
    const cells: Array<{ ymd: string; day: number; currMonth: boolean; disabled: boolean }> = [];
    // Days from prev month
    const prevMonthDays = new Date(calYear, calMonth, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const m = calMonth === 0 ? 12 : calMonth;
      const y = calMonth === 0 ? calYear - 1 : calYear;
      const ymd = `${y}-${String(m).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      cells.push({ ymd, day: d, currMonth: false, disabled: true });
    }
    // Days in current month
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const effMin = minDateYmd || todayYmd();
    for (let d = 1; d <= daysInMonth; d++) {
      const ymd = `${calYear}-${String(calMonth+1).padStart(2,"0")}-${String(d).padStart(2,"0")}`;
      cells.push({ ymd, day: d, currMonth: true, disabled: ymd < effMin });
    }
    // Fill remaining to 42 cells (6 rows)
    let nextDay = 1;
    while (cells.length < 42) {
      const m = calMonth === 11 ? 1 : calMonth + 2;
      const y = calMonth === 11 ? calYear + 1 : calYear;
      const ymd = `${y}-${String(m).padStart(2,"0")}-${String(nextDay).padStart(2,"0")}`;
      cells.push({ ymd, day: nextDay, currMonth: false, disabled: true });
      nextDay++;
    }
    return cells;
  }

  function prevMonth() {
    setCalMonth((m) => {
      if (m === 0) { setCalYear((y) => y - 1); return 11; }
      return m - 1;
    });
  }
  function nextMonth() {
    setCalMonth((m) => {
      if (m === 11) { setCalYear((y) => y + 1); return 0; }
      return m + 1;
    });
  }

  function handleConfirm() {
    if (!selectedYmd) return;
    onConfirm(ymdToDdMmYy(selectedYmd), selectedTime);
    onClose();
  }

  const { style: panelStyle, ready: panelReady } = useAnchoredPopoverPosition(
    isOpen,
    anchorRef,
    panelRef,
    { panelWidth: 360 },
  );

  if (!isOpen || !panelReady || typeof document === "undefined") return null;

  const cells = buildCalendarDays();

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`اختر ${label}`}
      style={panelStyle}
      className="datetime-popover flex flex-col overflow-hidden rounded-2xl border border-[#ebe4d3] bg-white shadow-[0_20px_60px_-10px_rgba(0,55,73,0.22),0_4px_16px_-4px_rgba(0,55,73,0.12)]"
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#f0ebe4] bg-gradient-to-l from-[#fdfbf6] to-[#f9f5ee] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-[#dbb878]/15">
            <Calendar className="size-3.5 text-[#dbb878]" />
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

      <div className="flex">
        {/* Calendar */}
        <div className="flex-1 p-3">
          {/* Month nav */}
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              onClick={prevMonth}
              className="flex size-7 items-center justify-center rounded-full text-[#8a7752] transition-colors hover:bg-[#f0ebe4] hover:text-[#003749]"
            >
              <ChevronRight className="size-4" />
            </button>
            <span className="text-[13px] font-bold text-[#003749]">
              {MONTHS_AR[calMonth]} {calYear}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              className="flex size-7 items-center justify-center rounded-full text-[#8a7752] transition-colors hover:bg-[#f0ebe4] hover:text-[#003749]"
            >
              <ChevronLeft className="size-4" />
            </button>
          </div>
          {/* Day headers */}
          <div className="mb-1 grid grid-cols-7 gap-0.5 text-center">
            {DAYS_AR.map((d) => (
              <span key={d} className="py-0.5 text-[10px] font-bold text-[#8a7752]">{d}</span>
            ))}
          </div>
          {/* Calendar cells */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((cell, i) => {
              const isSelected = cell.ymd === selectedYmd;
              const isToday = cell.ymd === todayYmd();
              return (
                <button
                  key={i}
                  type="button"
                  disabled={cell.disabled || !cell.currMonth}
                  onClick={() => !cell.disabled && cell.currMonth && setSelectedYmd(cell.ymd)}
                  className={`relative flex h-8 w-full items-center justify-center rounded-lg text-[12px] font-semibold transition-all
                    ${!cell.currMonth ? "opacity-0 pointer-events-none" : ""}
                    ${cell.disabled && cell.currMonth ? "cursor-not-allowed text-[#ddd] opacity-50" : ""}
                    ${isSelected && !cell.disabled
                      ? "bg-gradient-to-br from-[#dbb878] to-[#c9a356] text-white shadow-[0_2px_8px_-2px_rgba(219,184,120,0.6)]"
                      : isToday && !cell.disabled
                      ? "border border-[#dbb878]/60 text-[#003749]"
                      : !cell.disabled && cell.currMonth
                      ? "text-[#3a2f1e] hover:bg-[#fdfbf6]"
                      : ""
                    }`}
                >
                  {cell.day}
                </button>
              );
            })}
          </div>
        </div>

        {/* Time picker */}
        {!timeReadOnly && (
          <div className="flex w-[90px] shrink-0 flex-col border-r border-[#f0ebe4]">
            <div className="flex items-center justify-center gap-1 border-b border-[#f0ebe4] bg-[#fdfbf6] py-2.5">
              <Clock className="size-3 text-[#dbb878]" />
              <span className="text-[11px] font-bold text-[#003749]">الوقت</span>
            </div>
            <div
              ref={timeListRef}
              className="flex-1 overflow-y-auto py-1"
              style={{ maxHeight: "240px" }}
            >
              {TIME_OPTIONS.map((t) => {
                const isActive = t === selectedTime;
                return (
                  <button
                    key={t}
                    type="button"
                    data-active={isActive}
                    onClick={() => setSelectedTime(t)}
                    className={`flex w-full items-center justify-center py-2 text-[12px] font-semibold tabular-nums transition-all
                      ${isActive
                        ? "bg-gradient-to-r from-[#dbb878] to-[#c9a356] text-white"
                        : "text-[#3a2f1e] hover:bg-[#fdfbf6]"
                      }`}
                  >
                    {t}
                  </button>
                );
              })}
            </div>
          </div>
        )}
        {timeReadOnly && (
          <div className="flex w-[90px] shrink-0 flex-col items-center justify-center border-r border-[#f0ebe4] bg-[#fdfbf6]">
            <Clock className="size-5 text-[#dbb878]/40 mb-1" />
            <span className="text-center text-[11px] font-semibold text-[#aaa08e] px-2">الوقت محدد آلياً</span>
          </div>
        )}
      </div>

      {/* Footer / confirm */}
      <div className="border-t border-[#f0ebe4] bg-[#fdfbf6] px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-[12px] font-bold text-[#003749]">
          {selectedYmd ? (
            <>
              <span>{ymdToDdMmYy(selectedYmd)}</span>
              {!timeReadOnly && <span className="text-[#dbb878]">•</span>}
              {!timeReadOnly && <span dir="ltr">{selectedTime}</span>}
            </>
          ) : (
            <span className="text-[#aaa08e]">لم يُحدد بعد</span>
          )}
        </div>
        <button
          type="button"
          disabled={!selectedYmd}
          onClick={handleConfirm}
          className="rounded-xl px-4 py-1.5 text-[12px] font-extrabold text-white transition-all disabled:opacity-40"
          style={{ background: "linear-gradient(135deg, #dbb878 0%, #c9a356 100%)" }}
        >
          تأكيد
        </button>
      </div>
    </div>,
    document.body,
  );
}
