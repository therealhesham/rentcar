"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarRange, Clock, Info, X, ChevronRight, ChevronLeft, MessageSquare } from "lucide-react";
import { useAnchoredPopoverPosition } from "@/lib/use-anchored-popover-position";
import { computeBookingDays } from "@/lib/booking-days";
import { formatYmdAsDdMmYy, parseDdMmYyToYmd } from "@/lib/booking-search-shared";

import {
  isBranchClosedOnDate,
  parseHmToMinutes,
  scheduleHasAnyRule,
  type BranchOpeningHoursSchedule,
} from "@/lib/branch-opening-hours";

import { useLocale } from "next-intl";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  startDateDdMmYy: string;
  endDateDdMmYy: string;
  pickupTime?: string;
  dropoffTime?: string;
  minDateYmd?: string;
  onRangeChange: (startDdMmYy: string, endDdMmYy: string) => void;
  onStartChange?: (startDdMmYy: string) => void;
  onPickupTimeChange?: (time: string) => void;
  onDropoffTimeChange?: (time: string) => void;
  onConfirmRangeAndTimes?: (
    startDdMmYy: string,
    endDdMmYy: string,
    pickupTime: string,
    dropoffTime: string,
  ) => void;
  anchorRef?: React.RefObject<HTMLElement | null>;
  extraAnchorRefs?: React.RefObject<HTMLElement | null>[];
  containerRef?: React.RefObject<HTMLElement | null>;
  startLabel?: string;
  endLabel?: string;
  schedule?: BranchOpeningHoursSchedule | null;
  pickupSchedule?: BranchOpeningHoursSchedule | null;
  dropoffSchedule?: BranchOpeningHoursSchedule | null;
  allowHolidayBooking?: boolean;
  lockTimesEqual?: boolean;
};

const MONTHS_NAMES_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];
const MONTHS_NAMES_EN = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

const DAY_HEADER_LABELS_AR = ["ح", "ن", "ث", "ر", "خ", "ج", "س"];
const DAY_HEADER_LABELS_EN = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const MONTH_SHORT_AR = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];
const MONTH_SHORT_EN = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];

const DAY_SHORT_AR = ["الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"];
const DAY_SHORT_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

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
  if (!endYmd || startYmd <= endYmd) return { start: startYmd, end: endYmd };
  return { start: endYmd, end: startYmd };
}

function formatYmdShortLocale(ymd: string, isRTL: boolean): string {
  if (!ymd) return "—";
  const dt = ymdToDate(ymd);
  if (!dt) return "—";
  const dayName = isRTL ? DAY_SHORT_AR[dt.getDay()] : DAY_SHORT_EN[dt.getDay()];
  const monthName = isRTL ? MONTH_SHORT_AR[dt.getMonth()] : MONTH_SHORT_EN[dt.getMonth()];
  return isRTL
    ? `${dayName}، ${dt.getDate()} ${monthName}`
    : `${dayName}, ${dt.getDate()} ${monthName}`;
}

function formatTime12h(timeStr: string, isRTL: boolean = false): string {
  if (!timeStr) return isRTL ? "05:00 م" : "05:00 pm";
  const lower = timeStr.toLowerCase().trim();
  let isPm = lower.includes("pm") || lower.includes("م");
  let isAm = lower.includes("am") || lower.includes("ص");

  const cleaned = lower.replace(/(am|pm|ص|م|\s)/g, "");
  const parts = cleaned.split(":");
  if (parts.length < 2) return timeStr;

  let h = parseInt(parts[0], 10);
  const m = parts[1] || "00";
  if (isNaN(h)) return timeStr;

  if (!isAm && !isPm) {
    isPm = h >= 12;
  }

  h = h % 12;
  if (h === 0) h = 12;

  const timeNum = `${String(h).padStart(2, "0")}:${m}`;
  if (isRTL) {
    return `${timeNum} ${isPm ? "م" : "ص"}`;
  }
  return `${timeNum} ${isPm ? "pm" : "am"}`;
}

function parseTimeTo24h(timeStr: string): string {
  if (!timeStr) return "17:00";
  const lower = timeStr.toLowerCase().trim();
  const isPm = lower.includes("pm") || lower.includes("م");
  const isAm = lower.includes("am") || lower.includes("ص");

  if (isPm || isAm) {
    const cleaned = lower.replace(/(am|pm|ص|م|\s)/g, "");
    const parts = cleaned.split(":");
    let h = parseInt(parts[0], 10);
    const m = parts[1] || "00";
    if (isNaN(h)) return "17:00";
    if (isPm && h < 12) h += 12;
    if (isAm && h === 12) h = 0;
    return `${String(h).padStart(2, "0")}:${m}`;
  }
  return timeStr;
}

type DayBounds =
  | { kind: "unrestricted" }
  | { kind: "closed" }
  | { kind: "range"; openM: number; closeM: number };

function resolveDayBounds(
  schedule: BranchOpeningHoursSchedule | null | undefined,
  ymdDate: string | null | undefined,
): DayBounds {
  if (!schedule || !scheduleHasAnyRule(schedule)) return { kind: "unrestricted" };
  if (!ymdDate) return { kind: "unrestricted" };
  const [y, m, d] = ymdDate.split("-").map(Number);
  if (!y || !m || !d) return { kind: "unrestricted" };
  const weekday = new Date(y, m - 1, d).getDay();
  const row = schedule.days[String(weekday)];
  if (!row || row.closed === true) return { kind: "closed" };
  const openM = row.open ? parseHmToMinutes(row.open) : null;
  const closeM = row.close ? parseHmToMinutes(row.close) : null;
  if (openM == null || closeM == null || openM >= closeM) return { kind: "closed" };
  return { kind: "range", openM, closeM };
}

function minMinutesIfToday(ymdDate: string | null | undefined): number | null {
  if (!ymdDate || ymdDate !== todayYmd()) return null;
  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  return Math.ceil(nowMinutes / 30) * 30;
}

function getTimeSlotOptionsForYmd(
  schedule: BranchOpeningHoursSchedule | null | undefined,
  ymdDate: string | null | undefined,
  isRTL: boolean = false,
): Array<{ value24h: string; label12h: string }> {
  const bounds = resolveDayBounds(schedule, ymdDate);
  if (bounds.kind === "closed") return [];

  let startM = 0;
  let endM = 1410; // 23:30

  if (bounds.kind === "range") {
    startM = bounds.openM;
    endM = bounds.closeM;
  }

  const minToday = minMinutesIfToday(ymdDate);
  if (minToday != null && minToday > startM) {
    startM = minToday;
  }

  const slots: Array<{ value24h: string; label12h: string }> = [];
  for (let m = startM; m <= endM; m += 30) {
    const h = Math.floor(m / 60);
    const min = m % 60;
    const hm = `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
    slots.push({
      value24h: hm,
      label12h: formatTime12h(hm, isRTL),
    });
  }
  return slots;
}

export function DateRangePickerPopover({
  isOpen,
  onClose,
  startDateDdMmYy,
  endDateDdMmYy,
  pickupTime = "05:00 pm",
  dropoffTime = "05:00 pm",
  minDateYmd,
  onRangeChange,
  onStartChange,
  onPickupTimeChange,
  onDropoffTimeChange,
  onConfirmRangeAndTimes,
  anchorRef,
  containerRef,
  extraAnchorRefs,
  schedule = null,
  pickupSchedule = null,
  dropoffSchedule = null,
  allowHolidayBooking = false,
  lockTimesEqual = false,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const fallbackAnchorRef = useRef<HTMLElement | null>(null);
  const activeAnchorRef = anchorRef ?? fallbackAnchorRef;

  const effPickupSchedule = pickupSchedule ?? schedule;
  const effDropoffSchedule = dropoffSchedule ?? schedule;

  const startYmdInit = (startDateDdMmYy ? parseDdMmYyToYmd(startDateDdMmYy) : null) || "";
  const endYmdInit = (endDateDdMmYy ? parseDdMmYyToYmd(endDateDdMmYy) : null) || "";
  const anchorYmd = startYmdInit || minDateYmd || todayYmd();
  const anchorDate = ymdToDate(anchorYmd) || new Date();

  const [calYear, setCalYear] = useState(anchorDate.getFullYear());
  const [calMonth, setCalMonth] = useState(anchorDate.getMonth());
  const [rangeStart, setRangeStart] = useState(startYmdInit);
  const [rangeEnd, setRangeEnd] = useState(endYmdInit);
  const [hoverYmd, setHoverYmd] = useState<string | null>(null);

  const locale = useLocale();
  const isRTL = locale === "ar";
  const monthNames = isRTL ? MONTHS_NAMES_AR : MONTHS_NAMES_EN;
  const dayHeaders = isRTL ? DAY_HEADER_LABELS_AR : DAY_HEADER_LABELS_EN;

  const [selectedPickupTime, setSelectedPickupTime] = useState(formatTime12h(pickupTime, isRTL));
  const [selectedDropoffTime, setSelectedDropoffTime] = useState(formatTime12h(dropoffTime, isRTL));
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const { style: panelStyle, ready: panelReady } = useAnchoredPopoverPosition(
    isOpen,
    activeAnchorRef,
    panelRef,
    { panelWidth: 740, gap: 8, forceBelow: true, autoScrollOnOpen: true, containerRef },
  );

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
    setSelectedPickupTime(formatTime12h(pickupTime, isRTL));
    setSelectedDropoffTime(formatTime12h(dropoffTime, isRTL));
  }, [isOpen, startDateDdMmYy, endDateDdMmYy, minDateYmd, pickupTime, dropoffTime, isRTL]);

  // Click outside listener
  useEffect(() => {
    if (!isOpen) return;
    function handler(e: MouseEvent) {
      const panel = panelRef.current;
      if (!panel) return;
      const target = e.target as Node;
      const anchors = [activeAnchorRef, ...(extraAnchorRefs ?? [])];
      const insideAnchor = anchors.some((ref) => ref?.current?.contains(target));
      if (!panel.contains(target) && !insideAnchor) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose, activeAnchorRef, extraAnchorRefs]);

  // Escape key listener
  useEffect(() => {
    if (!isOpen) return;
    function handler(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const previewStart = () => {
    if (!rangeStart) return "";
    if (rangeEnd) return rangeStart;
    if (hoverYmd) return normalizeRange(rangeStart, hoverYmd).start;
    return rangeStart;
  };

  const previewEnd = () => {
    if (rangeEnd) return rangeEnd;
    if (rangeStart && hoverYmd) {
      const { end } = normalizeRange(rangeStart, hoverYmd);
      return end;
    }
    return "";
  };

  const effStart = previewStart();
  const effEnd = previewEnd();
  const pickingEnd = Boolean(rangeStart && !rangeEnd);

  const pickupTimeSlots = useMemo(
    () => getTimeSlotOptionsForYmd(effPickupSchedule, effStart, isRTL),
    [effPickupSchedule, effStart, isRTL],
  );

  const dropoffTimeSlots = useMemo(
    () => getTimeSlotOptionsForYmd(effDropoffSchedule, effEnd, isRTL),
    [effDropoffSchedule, effEnd, isRTL],
  );

  if (!isOpen || (!isMobile && !panelReady) || typeof document === "undefined") return null;

  function buildMonthCells(year: number, month: number) {
    const firstDay = new Date(year, month, 1).getDay(); // 0 = Sunday (Su)
    const cells: Array<{ ymd: string; day: number; currMonth: boolean; disabled: boolean }> = [];

    const prevMonthDays = new Date(year, month, 0).getDate();
    for (let i = firstDay - 1; i >= 0; i--) {
      const d = prevMonthDays - i;
      const m = month === 0 ? 12 : month;
      const y = month === 0 ? year - 1 : year;
      const ymd = `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      cells.push({ ymd, day: d, currMonth: false, disabled: true });
    }

    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const effMin = minDateYmd || todayYmd();
    for (let d = 1; d <= daysInMonth; d++) {
      const ymd = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
      const isClosedHoliday = !allowHolidayBooking && isBranchClosedOnDate(ymd, schedule);
      cells.push({ ymd, day: d, currMonth: true, disabled: ymd < effMin || isClosedHoliday });
    }

    const targetTotal = cells.length > 35 ? 42 : 35;
    let nextDay = 1;
    while (cells.length < targetTotal) {
      const m = month === 11 ? 1 : month + 2;
      const y = month === 11 ? year + 1 : year;
      const ymd = `${y}-${String(m).padStart(2, "0")}-${String(nextDay).padStart(2, "0")}`;
      cells.push({ ymd, day: nextDay, currMonth: false, disabled: true });
      nextDay++;
    }

    return cells;
  }

  const month1Year = calYear;
  const month1Index = calMonth;
  const month2Index = (calMonth + 1) % 12;
  const month2Year = calMonth === 11 ? calYear + 1 : calYear;

  const month1Cells = buildMonthCells(month1Year, month1Index);
  const month2Cells = buildMonthCells(month2Year, month2Index);

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
      const startFmt = formatYmdAsDdMmYy(ymd);
      if (startFmt) onStartChange?.(startFmt);
      return;
    }

    const { start, end } = normalizeRange(rangeStart, ymd);
    setRangeStart(start);
    setRangeEnd(end);
    setHoverYmd(null);
    const startFmt = formatYmdAsDdMmYy(start);
    const endFmt = formatYmdAsDdMmYy(end);
    if (startFmt && endFmt) onRangeChange(startFmt, endFmt);
  }

  function cellInRange(ymd: string): boolean {
    if (!effStart || !effEnd) return false;
    return ymd >= effStart && ymd <= effEnd;
  }

  function computeDays(): number | null {
    if (!effStart || !effEnd) return null;
    const a = ymdToDate(effStart);
    const b = ymdToDate(effEnd);
    if (!a || !b) return null;
    return computeBookingDays(a, b);
  }

  const daysCount = computeDays();

  function handleConfirm() {
    const startFmt = formatYmdAsDdMmYy(effStart || rangeStart);
    const endFmt = formatYmdAsDdMmYy(effEnd || rangeEnd || effStart || rangeStart);
    const pTime24 = parseTimeTo24h(selectedPickupTime);
    const dTime24 = parseTimeTo24h(selectedDropoffTime);

    if (startFmt && endFmt) {
      onRangeChange(startFmt, endFmt);
      onPickupTimeChange?.(pTime24);
      onDropoffTimeChange?.(dTime24);
      onConfirmRangeAndTimes?.(startFmt, endFmt, pTime24, dTime24);
    }
    onClose();
  }

  const formattedPickupDateStr = formatYmdShortLocale(effStart, isRTL);
  const formattedDropoffDateStr = formatYmdShortLocale(effEnd, isRTL);

  if (isMobile) {
    return createPortal(
      <div
        role="dialog"
        aria-label="إختيار التاريخ و الوقت"
        className="fixed inset-0 z-[100] flex flex-col justify-between bg-white text-right font-sans"
        dir={isRTL ? "rtl" : "ltr"}
      >
        {/* Header Bar */}
        <div className="flex items-center justify-between border-b border-[#f0ebe4] px-4 py-3 bg-gradient-to-l from-[#fdfbf6] to-[#f9f5ee] shrink-0">
          <button
            type="button"
            onClick={() => {
              setRangeStart("");
              setRangeEnd("");
              setHoverYmd(null);
            }}
            className="text-[#003749] font-bold text-sm hover:text-[#c9a356] hover:underline focus:outline-none"
          >
            إعادة تعيين
          </button>
          <h3 className="text-base font-bold text-[#003749]">إختيار التاريخ و الوقت</h3>
          <button
            type="button"
            onClick={onClose}
            className="flex size-7 items-center justify-center rounded-full text-[#8a7752] hover:bg-[#f0ebe4] hover:text-[#003749]"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Scrollable Content (Multi-Month Calendar + Time Picker) */}
        <div className="flex-1 overflow-y-auto overscroll-contain scroll-smooth px-4 py-3 space-y-6 pb-28">
          {/* Calendar Section: 3 Consecutive Months with Navigation */}
          {[
            { year: month1Year, month: month1Index, cells: month1Cells, isFirst: true },
            { year: month2Year, month: month2Index, cells: month2Cells, isFirst: false },
          ].map(({ year, month, cells, isFirst }) => (
            <div key={`${year}-${month}`} className="space-y-2">
              {/* Month Header with Navigation Controls */}
              <div className="flex items-center justify-between font-bold text-[#003749] text-sm tracking-wider uppercase px-1">
                <span className="text-base font-extrabold text-[#003749]">{`${monthNames[month]} ${year}`}</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={prevMonth}
                    className="flex size-7 items-center justify-center rounded-full text-[#003749] hover:bg-[#f0ebe4] active:scale-95 transition-all"
                    aria-label="الشهر السابق"
                  >
                    <ChevronRight className="size-4 text-[#003749]" />
                  </button>
                  <button
                    type="button"
                    onClick={nextMonth}
                    className="flex size-7 items-center justify-center rounded-full text-[#003749] hover:bg-[#f0ebe4] active:scale-95 transition-all"
                    aria-label="الشهر التالي"
                  >
                    <ChevronLeft className="size-4 text-[#003749]" />
                  </button>
                </div>
              </div>

              {/* Day Headers */}
              <div className="grid grid-cols-7 text-center text-xs font-semibold text-[#8a7752] py-1 border-b border-[#f0ebe4]">
                {dayHeaders.map((dh, i) => (
                  <span key={i}>{dh}</span>
                ))}
              </div>

              {/* Month Days Grid */}
              <div className="grid grid-cols-7 gap-y-1 text-center text-xs font-medium">
                {cells.map(({ ymd, day, currMonth, disabled }, idx) => {
                  if (!currMonth) {
                    return <div key={idx} className="h-8" />;
                  }

                  const isStart = ymd === effStart;
                  const isEnd = ymd === effEnd;
                  const inRange = cellInRange(ymd);
                  const isSelected = isStart || isEnd;

                  return (
                    <div key={idx} className="relative flex items-center justify-center h-8">
                      {inRange && !isSelected && (
                        <div className="absolute inset-y-1 inset-x-0 bg-[#dbb878]/20" />
                      )}
                      <button
                        type="button"
                        disabled={disabled}
                        onClick={() => handleDayClick(ymd)}
                        className={`relative z-10 size-8 flex items-center justify-center rounded-full text-xs font-bold transition-all touch-manipulation active:scale-95 ${
                          disabled
                            ? "text-gray-300 pointer-events-none"
                            : isSelected
                              ? "bg-[#003749] text-white font-extrabold shadow-sm scale-105"
                              : inRange
                                ? "text-[#003749] font-bold"
                                : "text-[#003749] hover:bg-[#fdfbf6]"
                        }`}
                      >
                        {day}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Time Picker Section */}
          <div className="border-t border-[#f0ebe4] pt-4 space-y-2">
            <div className="grid grid-cols-2 gap-3 text-center">
              {/* Pickup Time Wheel (الاستلام) */}
              <WheelTimePicker
                label="الاستلام"
                value={selectedPickupTime}
                options={pickupTimeSlots}
                onChange={(t) => {
                  setSelectedPickupTime(t);
                  if (lockTimesEqual) setSelectedDropoffTime(t);
                }}
              />

              {/* Return Time Wheel (التسليم) */}
              <WheelTimePicker
                label="التسليم"
                value={selectedDropoffTime}
                options={dropoffTimeSlots}
                disabled={lockTimesEqual}
                onChange={(t) => setSelectedDropoffTime(t)}
              />
            </div>
          </div>
        </div>

        {/* Bottom Confirm Action Button */}
        <div className="sticky bottom-0 border-t border-[#f0ebe4] p-3.5 bg-white shrink-0 shadow-lg z-20">
          <button
            type="button"
            onClick={handleConfirm}
            className="w-full bg-gradient-to-r from-[#003749] to-[#004d63] hover:from-[#002835] hover:to-[#003d4f] active:scale-[0.99] text-white font-extrabold py-3.5 rounded-xl text-base text-center transition-all shadow-md"
          >
            تأكيد
          </button>
        </div>
      </div>,
      document.body
    );
  }

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label="تواريخ وأوقات الحجز"
      style={panelStyle}
      className="datetime-popover flex flex-col overflow-hidden rounded-2xl border border-[#ebe4d3] bg-white shadow-[0_20px_60px_-10px_rgba(0,55,73,0.22),0_4px_16px_-4px_rgba(0,55,73,0.12)] text-right"
      dir={isRTL ? "rtl" : "ltr"}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#f0ebe4] bg-gradient-to-l from-[#fdfbf6] to-[#f9f5ee] px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-full bg-[#dbb878]/15">
            <CalendarRange className="size-3.5 text-[#dbb878]" />
          </span>
          <span className="text-[13px] font-bold text-[#003749]">
            {isRTL ? "تواريخ وأوقات الحجز" : "Booking Dates & Times"}
          </span>
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

      {/* Main Content */}
      <div className="p-4 sm:p-5 bg-white">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 items-start">
          {/* Dual Month Calendar (Right Side in RTL - First in DOM) */}
          <div className="md:col-span-7 flex flex-col gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Month 1 (August / Far Right Month) */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-2 px-1">
                  <button
                    type="button"
                    onClick={prevMonth}
                    className="flex size-6 items-center justify-center rounded-full text-[#8a7752] transition-colors hover:bg-[#f0ebe4] hover:text-[#003749]"
                    title={isRTL ? "الشهر السابق" : "Previous Month"}
                  >
                    <ChevronRight className="size-3.5" />
                  </button>
                  <span className="text-[12px] font-bold text-[#003749]">
                    {monthNames[month1Index]} {month1Year}
                  </span>
                  <div className="size-6" />
                </div>

                <div className="grid grid-cols-7 text-center mb-1">
                  {dayHeaders.map((d) => (
                    <span key={d} className="text-[10px] font-bold text-[#8a7752] py-0.5">
                      {d}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-0.5">
                  {month1Cells.map((cell, i) => {
                    const inRange = cellInRange(cell.ymd);
                    const isStart = cell.ymd === effStart;
                    const isEnd = cell.ymd === effEnd && Boolean(effEnd);
                    const isToday = cell.ymd === todayYmd();

                    return (
                      <button
                        key={`m1-${i}`}
                        type="button"
                        disabled={cell.disabled || !cell.currMonth}
                        onMouseEnter={() => {
                          if (pickingEnd && !cell.disabled && cell.currMonth) setHoverYmd(cell.ymd);
                        }}
                        onMouseLeave={() => setHoverYmd(null)}
                        onClick={() => !cell.disabled && cell.currMonth && handleDayClick(cell.ymd)}
                        className={`relative flex h-7 w-full items-center justify-center text-[11px] font-semibold transition-all rounded-md
                          ${!cell.currMonth ? "pointer-events-none opacity-0" : ""}
                          ${cell.disabled && cell.currMonth ? "cursor-not-allowed text-[#ddd] opacity-50" : ""}
                          ${
                            isStart || isEnd
                              ? "z-10 bg-gradient-to-br from-[#dbb878] to-[#c9a356] text-white font-bold shadow-[0_2px_8px_-2px_rgba(219,184,120,0.6)]"
                              : inRange && !cell.disabled
                                ? "rounded-none bg-[#dbb878]/20 text-[#003749] font-semibold"
                                : isToday && !cell.disabled
                                  ? "border border-[#dbb878]/60 text-[#003749] font-bold"
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

              {/* Month 2 (September / Middle Right Month) */}
              <div className="flex flex-col">
                <div className="flex items-center justify-between mb-2 px-1">
                  <div className="size-6" />
                  <span className="text-[12px] font-bold text-[#003749]">
                    {monthNames[month2Index]} {month2Year}
                  </span>
                  <button
                    type="button"
                    onClick={nextMonth}
                    className="flex size-6 items-center justify-center rounded-full text-[#8a7752] transition-colors hover:bg-[#f0ebe4] hover:text-[#003749]"
                    title={isRTL ? "الشهر التالي" : "Next Month"}
                  >
                    <ChevronLeft className="size-3.5" />
                  </button>
                </div>

                <div className="grid grid-cols-7 text-center mb-1">
                  {dayHeaders.map((d) => (
                    <span key={d} className="text-[10px] font-bold text-[#8a7752] py-0.5">
                      {d}
                    </span>
                  ))}
                </div>

                <div className="grid grid-cols-7 gap-0.5">
                  {month2Cells.map((cell, i) => {
                    const inRange = cellInRange(cell.ymd);
                    const isStart = cell.ymd === effStart;
                    const isEnd = cell.ymd === effEnd && Boolean(effEnd);
                    const isToday = cell.ymd === todayYmd();

                    return (
                      <button
                        key={`m2-${i}`}
                        type="button"
                        disabled={cell.disabled || !cell.currMonth}
                        onMouseEnter={() => {
                          if (pickingEnd && !cell.disabled && cell.currMonth) setHoverYmd(cell.ymd);
                        }}
                        onMouseLeave={() => setHoverYmd(null)}
                        onClick={() => !cell.disabled && cell.currMonth && handleDayClick(cell.ymd)}
                        className={`relative flex h-7 w-full items-center justify-center text-[11px] font-semibold transition-all rounded-md
                          ${!cell.currMonth ? "pointer-events-none opacity-0" : ""}
                          ${cell.disabled && cell.currMonth ? "cursor-not-allowed text-[#ddd] opacity-50" : ""}
                          ${
                            isStart || isEnd
                              ? "z-10 bg-gradient-to-br from-[#dbb878] to-[#c9a356] text-white font-bold shadow-[0_2px_8px_-2px_rgba(219,184,120,0.6)]"
                              : inRange && !cell.disabled
                                ? "rounded-none bg-[#dbb878]/20 text-[#003749] font-semibold"
                                : isToday && !cell.disabled
                                  ? "border border-[#dbb878]/60 text-[#003749] font-bold"
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
            </div>
          </div>

          {/* Time Columns (Left Side in RTL - Second in DOM) */}
          <div className="md:col-span-5 grid grid-cols-2 gap-2.5 border-t md:border-t-0 md:border-s border-[#f0ebe4] pt-4 md:pt-0 md:ps-4">
            {/* Pickup Time Column */}
            <div className="flex flex-col gap-1.5">
              <h4 className="text-[12px] font-bold text-[#003749]">اختر وقت الاستلام</h4>
              <p className="text-[10px] font-semibold text-[#8a7752] min-h-[14px]">
                {formattedPickupDateStr !== "—" ? formattedPickupDateStr : ""}
              </p>
              <div className="grid grid-cols-2 gap-1 max-h-[220px] overflow-y-auto pe-1 custom-scrollbar">
                {pickupTimeSlots.length > 0 ? (
                  pickupTimeSlots.map((slot) => {
                    const isSelected = slot.label12h === selectedPickupTime;
                    return (
                      <button
                        key={`pickup-${slot.value24h}`}
                        type="button"
                        onClick={() => {
                          setSelectedPickupTime(slot.label12h);
                          if (lockTimesEqual) setSelectedDropoffTime(slot.label12h);
                        }}
                        className={`h-8 w-full rounded-lg text-[11px] font-semibold transition-all ${
                          isSelected
                            ? "bg-gradient-to-br from-[#dbb878] to-[#c9a356] text-white shadow-[0_2px_8px_-2px_rgba(219,184,120,0.6)]"
                            : "bg-[#fdfbf6] border border-[#ebe4d3] text-[#003749] hover:border-[#dbb878] hover:bg-[#f0ebe4]"
                        }`}
                      >
                        {slot.label12h}
                      </button>
                    );
                  })
                ) : (
                  <div className="col-span-2 py-4 text-center text-[11px] font-medium text-[#8a7752]">
                    {isRTL ? "الفرع مغلق هذا اليوم" : "Closed on this day"}
                  </div>
                )}
              </div>
            </div>

            {/* Return Time Column */}
            <div className="flex flex-col gap-1.5">
              <h4 className="text-[12px] font-bold text-[#003749]">اختر وقت العودة</h4>
              <p className="text-[10px] font-semibold text-[#8a7752] min-h-[14px]">
                {formattedDropoffDateStr !== "—" ? formattedDropoffDateStr : ""}
              </p>
              <div className="grid grid-cols-2 gap-1 max-h-[220px] overflow-y-auto pe-1 custom-scrollbar">
                {dropoffTimeSlots.length > 0 ? (
                  dropoffTimeSlots.map((slot) => {
                    const isSelected = slot.label12h === selectedDropoffTime;
                    return (
                      <button
                        key={`dropoff-${slot.value24h}`}
                        type="button"
                        onClick={() => {
                          setSelectedDropoffTime(slot.label12h);
                          if (lockTimesEqual) setSelectedPickupTime(slot.label12h);
                        }}
                        className={`h-8 w-full rounded-lg text-[11px] font-semibold transition-all ${
                          isSelected
                            ? "bg-gradient-to-br from-[#dbb878] to-[#c9a356] text-white shadow-[0_2px_8px_-2px_rgba(219,184,120,0.6)]"
                            : "bg-[#fdfbf6] border border-[#ebe4d3] text-[#003749] hover:border-[#dbb878] hover:bg-[#f0ebe4]"
                        }`}
                      >
                        {slot.label12h}
                      </button>
                    );
                  })
                ) : (
                  <div className="col-span-2 py-4 text-center text-[11px] font-medium text-[#8a7752]">
                    {isRTL ? "الفرع مغلق هذا اليوم" : "Closed on this day"}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Bar */}
      <div className="border-t border-[#f0ebe4] bg-[#fdfbf6] px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-2.5 text-[11px]">
        {/* Action Button */}
        <button
          type="button"
          onClick={handleConfirm}
          className="w-full sm:w-auto order-last sm:order-first px-5 py-2 rounded-xl bg-gradient-to-r from-[#dbb878] to-[#c9a356] hover:from-[#c9a356] hover:to-[#b89245] text-white font-bold shadow-md transition-all active:scale-95 text-[12px]"
        >
          إختر التواريخ
        </button>

        {/* Info note */}
        <div className="flex items-center gap-1 text-[#8a7752] text-[10px] order-2 sm:order-2">
          <Info className="size-3 text-[#dbb878] shrink-0" />
          <span>تستند الأوقات إلى ساعات عمل الفرع المحدد.</span>
        </div>

        {/* Summary Items */}
        <div className="flex flex-wrap items-center justify-center gap-3 text-[11px] font-semibold text-[#003749] order-1 sm:order-3">
          {/* Duration */}
          <div className="flex items-center gap-1">
            <Clock className="size-3.5 text-[#dbb878]" />
            <span className="text-[#8a7752]">مدة الإيجار:</span>
            <span className="font-bold text-[#003749]">{daysCount ?? 0} أيام</span>
          </div>

          {/* Return */}
          <div className="flex items-center gap-1">
            <CalendarRange className="size-3.5 text-[#dbb878]" />
            <span className="text-[#8a7752]">التسليم:</span>
            <span className="font-bold text-[#003749] dir-ltr">
              {formattedDropoffDateStr !== "—"
                ? `${formattedDropoffDateStr} · ${selectedDropoffTime}`
                : "—"}
            </span>
          </div>

          {/* Pickup */}
          <div className="flex items-center gap-1">
            <CalendarRange className="size-3.5 text-[#dbb878]" />
            <span className="text-[#8a7752]">الاستلام:</span>
            <span className="font-bold text-[#003749] dir-ltr">
              {formattedPickupDateStr !== "—"
                ? `${formattedPickupDateStr} · ${selectedPickupTime}`
                : "—"}
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}

/* ─────────────────────────────────────────
   WheelTimePicker: Elegant drum/wheel time selector
───────────────────────────────────────── */
function WheelTimePicker({
  label,
  value,
  options,
  onChange,
  disabled = false,
}: {
  label: string;
  value: string;
  options: Array<{ value24h: string; label12h: string }>;
  onChange: (val: string) => void;
  disabled?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedIndex = useMemo(() => {
    const idx = options.findIndex((o) => o.label12h === value);
    return idx >= 0 ? idx : 0;
  }, [options, value]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const itemHeight = 38;
    el.scrollTo({
      top: selectedIndex * itemHeight,
      behavior: "smooth",
    });
  }, [selectedIndex]);

  return (
    <div className="flex flex-col gap-1.5 flex-1 min-w-0">
      <span className="text-xs font-bold text-slate-800 text-center tracking-wide">{label}</span>
      <div className={`relative h-[114px] overflow-hidden bg-white select-none ${disabled ? "opacity-30 pointer-events-none" : ""}`}>
        {/* Scroll list */}
        <div
          ref={containerRef}
          className="h-full overflow-y-auto scroll-smooth snap-y snap-mandatory py-[38px]"
          style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
        >
          {options.length > 0 ? (
            options.map((opt, i) => {
              const isSelected = i === selectedIndex;
              const isAdjacent = Math.abs(i - selectedIndex) === 1;

              return (
                <button
                  key={opt.value24h}
                  type="button"
                  onClick={() => onChange(opt.label12h)}
                  className={`snap-center flex h-[38px] w-full items-center justify-center text-center transition-all duration-200 ${
                    isSelected
                      ? "text-lg font-black text-slate-900 scale-105"
                      : isAdjacent
                        ? "text-xs font-semibold text-gray-300 opacity-70"
                        : "text-[10px] font-medium text-gray-200 opacity-30"
                  }`}
                >
                  {opt.label12h}
                </button>
              );
            })
          ) : (
            <div className="flex h-[38px] items-center justify-center text-xs text-gray-400">
              مغلق
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

