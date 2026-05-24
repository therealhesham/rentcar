"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarRange, X, ChevronRight, ChevronLeft } from "lucide-react";
import { useAnchoredPopoverPosition } from "@/lib/use-anchored-popover-position";
import { computeBookingDays } from "@/lib/booking-days";
import { formatYmdAsDdMmYy, parseDdMmYyToYmd } from "@/lib/booking-search-shared";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  startDateDdMmYy: string;
  endDateDdMmYy: string;
  minDateYmd?: string;
  onRangeChange: (startDdMmYy: string, endDdMmYy: string) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  startLabel?: string;
  endLabel?: string;
};

const MONTHS_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];
const DAYS_AR = ["ح", "ن", "ث", "ر", "خ", "ج", "س"];

function ymdToDate(ymd: string): Date | null {
  if (!ymd || ymd.length < 10) return null;
  const [y, m, d] = ymd.split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

function todayYmd(): string {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

function normalizeRange(startYmd: string, endYmd: string): { start: string; end: string } {
  if (startYmd <= endYmd) return { start: startYmd, end: endYmd };
  return { start: endYmd, end: startYmd };
}

export function DateRangePickerPopover({
  isOpen,
  onClose,
  startDateDdMmYy,
  endDateDdMmYy,
  minDateYmd,
  onRangeChange,
  anchorRef,
  startLabel = "الاستلام",
  endLabel = "التسليم",
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const startYmdInit = (startDateDdMmYy ? parseDdMmYyToYmd(startDateDdMmYy) : null) || "";
  const endYmdInit = (endDateDdMmYy ? parseDdMmYyToYmd(endDateDdMmYy) : null) || "";
  const anchorYmd = startYmdInit || minDateYmd || todayYmd();
  const anchorDate = ymdToDate(anchorYmd) || new Date();

  const [calYear, setCalYear] = useState(anchorDate.getFullYear());
  const [calMonth, setCalMonth] = useState(anchorDate.getMonth());
  const [rangeStart, setRangeStart] = useState(startYmdInit);
  const [rangeEnd, setRangeEnd] = useState(endYmdInit);
  const [hoverYmd, setHoverYmd] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    const s = (startDateDdMmYy ? parseDdMmYyToYmd(startDateDdMmYy) : null) || "";
    const e = (endDateDdMmYy ? parseDdMmYyToYmd(endDateDdMmYy) : null) || "";
    const anchor = s || minDateYmd || todayYmd();
    const d = ymdToDate(anchor) || new Date();
    setCalYear(d.getFullYear());
    setCalMonth(d.getMonth());
    setRangeStart(s);
    setRangeEnd(e);
    setHoverYmd(null);
  }, [isOpen, startDateDdMmYy, endDateDdMmYy, minDateYmd]);

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

  function buildCalendarDays(): Array<{ ymd: string; day: number; currMonth: boolean; disabled: boolean }> {
    const firstDay = new Date(calYear, calMonth, 1).getDay();
    const cells: Array<{ ymd: string; day: number; currMonth: boolean; disabled: boolean }> = [];
    const prevMonthDays = new Date(calYear, calMonth, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const m = calMonth === 0 ? 12 : calMonth;
      const y = calMonth === 0 ? calYear - 1 : calYear;
      const ymd = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ ymd, day: d, currMonth: false, disabled: true });
    }
    const daysInMonth = new Date(calYear, calMonth + 1, 0).getDate();
    const effMin = minDateYmd || todayYmd();
    for (let d = 1; d <= daysInMonth; d++) {
      const ymd = `${calYear}-${String(calMonth + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ ymd, day: d, currMonth: true, disabled: ymd < effMin });
    }
    let nextDay = 1;
    while (cells.length < 42) {
      const m = calMonth === 11 ? 1 : calMonth + 2;
      const y = calMonth === 11 ? calYear + 1 : calYear;
      const ymd = `${y}-${String(m).padStart(2, "0")}-${String(nextDay).padStart(2, "0")}`;
      cells.push({ ymd, day: nextDay, currMonth: false, disabled: true });
      nextDay++;
    }
    return cells;
  }

  function prevMonth() {
    setCalMonth((m) => {
      if (m === 0) {
        setCalYear((y) => y - 1);
        return 11;
      }
      return m - 1;
    });
  }

  function nextMonth() {
    setCalMonth((m) => {
      if (m === 11) {
        setCalYear((y) => y + 1);
        return 0;
      }
      return m + 1;
    });
  }

  function handleDayClick(ymd: string) {
    if (!rangeStart || (rangeStart && rangeEnd)) {
      setRangeStart(ymd);
      setRangeEnd("");
      setHoverYmd(null);
      return;
    }

    const { start, end } = normalizeRange(rangeStart, ymd);
    setRangeStart(start);
    setRangeEnd(end);
    setHoverYmd(null);
    const startFmt = formatYmdAsDdMmYy(start);
    const endFmt = formatYmdAsDdMmYy(end);
    if (startFmt && endFmt) onRangeChange(startFmt, endFmt);
    onClose();
  }

  function previewEnd(): string {
    if (rangeEnd) return rangeEnd;
    if (rangeStart && hoverYmd) {
      const { end } = normalizeRange(rangeStart, hoverYmd);
      return end;
    }
    return "";
  }

  function previewStart(): string {
    if (!rangeStart) return "";
    if (rangeEnd) return rangeStart;
    if (hoverYmd) return normalizeRange(rangeStart, hoverYmd).start;
    return rangeStart;
  }

  const effStart = previewStart();
  const effEnd = previewEnd();

  function cellInRange(ymd: string): boolean {
    if (!effStart || !effEnd) return false;
    return ymd >= effStart && ymd <= effEnd;
  }

  function daysPreview(): number | null {
    if (!effStart || !effEnd) return null;
    const a = ymdToDate(effStart);
    const b = ymdToDate(effEnd);
    if (!a || !b) return null;
    return computeBookingDays(a, b);
  }

  const { style: panelStyle, ready: panelReady } = useAnchoredPopoverPosition(
    isOpen,
    anchorRef,
    panelRef,
    { panelWidth: 320 },
  );

  if (!isOpen || !panelReady || typeof document === "undefined") return null;

  const cells = buildCalendarDays();
  const days = daysPreview();
  const pickingEnd = Boolean(rangeStart && !rangeEnd);

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="اختر تواريخ الاستلام والتسليم"
      style={panelStyle}
      className="datetime-popover flex flex-col overflow-hidden rounded-2xl border border-[#ebe4d3] bg-white shadow-[0_20px_60px_-10px_rgba(0,55,73,0.22),0_4px_16px_-4px_rgba(0,55,73,0.12)]"
      dir="rtl"
    >
      <div className="flex items-center justify-between border-b border-[#f0ebe4] bg-gradient-to-l from-[#fdfbf6] to-[#f9f5ee] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-[#dbb878]/15">
            <CalendarRange className="size-3.5 text-[#dbb878]" />
          </span>
          <span className="text-[13px] font-bold text-[#003749]">تواريخ الحجز</span>
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

      <div className="grid grid-cols-2 gap-2 border-b border-[#f0ebe4] bg-[#fdfbf6] px-4 py-2.5 text-[11px]">
        <div className={`rounded-lg px-2 py-1.5 ${pickingEnd ? "ring-2 ring-[#dbb878]/50 bg-white" : ""}`}>
          <span className="block font-bold text-[#8a7752]">{startLabel}</span>
          <span className="font-bold text-[#003749]">
            {rangeStart ? formatYmdAsDdMmYy(rangeStart) : "—"}
          </span>
        </div>
        <div className={`rounded-lg px-2 py-1.5 ${pickingEnd ? "bg-white/60" : rangeEnd ? "bg-white" : ""}`}>
          <span className="block font-bold text-[#8a7752]">{endLabel}</span>
          <span className="font-bold text-[#003749]">
            {rangeEnd ? formatYmdAsDdMmYy(rangeEnd) : pickingEnd ? "اختر التاريخ" : "—"}
          </span>
        </div>
      </div>

      <div className="p-3">
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
        <div className="mb-1 grid grid-cols-7 gap-0.5 text-center">
          {DAYS_AR.map((d) => (
            <span key={d} className="py-0.5 text-[10px] font-bold text-[#8a7752]">
              {d}
            </span>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-0.5">
          {cells.map((cell, i) => {
            const inRange = cellInRange(cell.ymd);
            const isStart = cell.ymd === effStart;
            const isEnd = cell.ymd === effEnd && Boolean(effEnd);
            const isToday = cell.ymd === todayYmd();
            return (
              <button
                key={i}
                type="button"
                disabled={cell.disabled || !cell.currMonth}
                onMouseEnter={() => {
                  if (pickingEnd && !cell.disabled && cell.currMonth) setHoverYmd(cell.ymd);
                }}
                onMouseLeave={() => setHoverYmd(null)}
                onClick={() => !cell.disabled && cell.currMonth && handleDayClick(cell.ymd)}
                className={`relative flex h-8 w-full items-center justify-center text-[12px] font-semibold transition-all
                  ${!cell.currMonth ? "pointer-events-none opacity-0" : ""}
                  ${cell.disabled && cell.currMonth ? "cursor-not-allowed text-[#ddd] opacity-50" : ""}
                  ${
                    isStart || isEnd
                      ? "z-10 rounded-lg bg-gradient-to-br from-[#dbb878] to-[#c9a356] text-white shadow-[0_2px_8px_-2px_rgba(219,184,120,0.6)]"
                      : inRange && !cell.disabled
                        ? "rounded-none bg-[#dbb878]/20 text-[#003749]"
                        : isToday && !cell.disabled
                          ? "rounded-lg border border-[#dbb878]/60 text-[#003749]"
                          : !cell.disabled && cell.currMonth
                            ? "rounded-lg text-[#3a2f1e] hover:bg-[#fdfbf6]"
                            : ""
                  }`}
              >
                {cell.day}
              </button>
            );
          })}
        </div>
      </div>

      <div className="border-t border-[#f0ebe4] bg-[#fdfbf6] px-4 py-3">
        <p className="text-center text-[12px] font-bold text-[#003749]">
          {pickingEnd ? (
            <span className="text-[#dbb878]">اختر تاريخ {endLabel}</span>
          ) : days != null ? (
            <span>
              مدة الحجز: <span className="tabular-nums text-[#dbb878]">{days}</span> يوم
            </span>
          ) : (
            <span className="text-[#aaa08e]">اختر تاريخ {startLabel} ثم {endLabel}</span>
          )}
        </p>
        {pickingEnd && days != null ? (
          <p className="mt-1 text-center text-[11px] font-semibold text-[#6b5a3b]">
            معاينة: <span className="tabular-nums">{days}</span> يوم
          </p>
        ) : null}
      </div>
    </div>,
    document.body,
  );
}
