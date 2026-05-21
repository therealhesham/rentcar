"use client";

import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { OVERLAY_BACKDROP_Z, OVERLAY_PANEL_Z } from "@/lib/overlay-z-index";

export type DdMmYyDateWithPickerProps = {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  /** YYYY-MM-DD لمزامنة التقويم */
  nativeYmd: string;
  onCalendarSelect: (ymd: string) => void;
  minYmd?: string;
  maxYmd?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  placeholder?: string;
  inputClassName?: string;
  buttonClassName?: string;
  rowClassName?: string;
  calendarButtonLabel?: string;
};

const AR_LOCALE_GREGORY = "ar-SA-u-ca-gregory";
/** عرض ثابت للوحة — لا يتمدد مع عرض حقل الإدخال على الديسكتوب */
const PANEL_WIDTH = 252;
const PANEL_EST_H = 252;

const CAL_VIEWS = [
  { id: "day" as const, label: "أيام" },
  { id: "month" as const, label: "شهر" },
  { id: "year" as const, label: "سنة" },
];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toYmd(y: number, m0: number, d: number): string {
  return `${y}-${pad2(m0 + 1)}-${pad2(d)}`;
}

function weekdayLabelsAr(): string[] {
  const out: string[] = [];
  const base = new Date(2023, 0, 1);
  for (let i = 0; i < 7; i++) {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    out.push(d.toLocaleDateString(AR_LOCALE_GREGORY, { weekday: "short" }));
  }
  return out;
}

const WEEKDAY_LABELS_AR = weekdayLabelsAr();

function buildMonthCells(viewYear: number, viewMonth0: number): (number | null)[] {
  const firstDow = new Date(viewYear, viewMonth0, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth0 + 1, 0).getDate();
  const cells: (number | null)[] = [];
  for (let i = 0; i < firstDow; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  while (cells.length % 7 !== 0) cells.push(null);
  const minCells = firstDow + daysInMonth > 35 ? 42 : 35;
  while (cells.length < minCells) cells.push(null);
  return cells;
}

function ymdInRange(ymd: string, minYmd?: string, maxYmd?: string): boolean {
  if (minYmd && ymd < minYmd) return false;
  if (maxYmd && ymd > maxYmd) return false;
  return true;
}

function monthNameAr(month0: number, short = false): string {
  return new Date(2024, month0, 1).toLocaleDateString(AR_LOCALE_GREGORY, {
    month: short ? "short" : "long",
  });
}

function formatYmdDisplayAr(ymd: string, compact = false): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) return null;
  const [y, mo, d] = ymd.split("-").map(Number);
  const dt = new Date(y, mo - 1, d);
  if (Number.isNaN(dt.getTime())) return null;
  if (compact) {
    return dt.toLocaleDateString(AR_LOCALE_GREGORY, {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  }
  return dt.toLocaleDateString(AR_LOCALE_GREGORY, {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

type CalView = "day" | "month" | "year";

function deriveYearBounds(minYmd?: string, maxYmd?: string): { start: number; end: number } {
  const todayY = new Date().getFullYear();
  let start = todayY;
  let end = todayY + 25;
  if (minYmd && /^\d{4}/.test(minYmd)) {
    start = Math.max(start, Number(minYmd.slice(0, 4)));
  }
  if (maxYmd && /^\d{4}/.test(maxYmd)) {
    end = Math.min(end, Number(maxYmd.slice(0, 4)));
  }
  if (end < start) end = start;
  return { start, end };
}

function monthHasSelectableDay(
  year: number,
  month0: number,
  minYmd?: string,
  maxYmd?: string,
): boolean {
  const daysInMonth = new Date(year, month0 + 1, 0).getDate();
  for (let d = 1; d <= daysInMonth; d++) {
    if (ymdInRange(toYmd(year, month0, d), minYmd, maxYmd)) return true;
  }
  return false;
}

function yearHasSelectableDay(year: number, minYmd?: string, maxYmd?: string): boolean {
  for (let m = 0; m < 12; m++) {
    if (monthHasSelectableDay(year, m, minYmd, maxYmd)) return true;
  }
  return false;
}

const navBtnClass =
  "flex size-6 shrink-0 items-center justify-center rounded-md border border-[#ebe4d3]/90 bg-white text-[#003749] outline-none transition-all hover:border-[#dbb878]/60 hover:bg-[#fffdf8] focus-visible:ring-1 focus-visible:ring-[#dbb878]/40 disabled:pointer-events-none disabled:opacity-40";

const chipBtnClass =
  "inline-flex min-h-6 min-w-0 flex-1 items-center justify-center rounded px-1.5 py-0.5 text-[10px] font-extrabold outline-none transition-all focus-visible:ring-1 focus-visible:ring-[#dbb878]/40";

function ViewPills({
  calView,
  onChange,
}: {
  calView: CalView;
  onChange: (v: CalView) => void;
}) {
  return (
    <div
      className="mb-1.5 flex gap-px rounded-md bg-[#f0ebe3]/80 p-px ring-1 ring-[#ebe4d3]/60"
      role="tablist"
      aria-label="مستوى التقويم"
    >
      {CAL_VIEWS.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          role="tab"
          aria-selected={calView === id}
          onClick={() => onChange(id)}
          className={`${chipBtnClass} ${
            calView === id
              ? "bg-[#003749] text-white shadow-sm"
              : "text-[#6b5a3b] hover:bg-white/90 hover:text-[#003749]"
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function PanelFooter({
  nativeYmd,
  onToday,
  todayEnabled,
}: {
  nativeYmd: string;
  onToday: () => void;
  todayEnabled: boolean;
}) {
  const label = formatYmdDisplayAr(nativeYmd, true);
  return (
    <div
      className="mt-1.5 flex items-center justify-between gap-1 border-t border-[#ebe4d3]/70 pt-1.5"
      dir="rtl"
    >
      {label ? (
        <p className="min-w-0 truncate text-[9px] font-semibold text-[#6b5a3b]">
          <span className="font-extrabold text-[#003749]">{label}</span>
        </p>
      ) : (
        <p className="text-[9px] font-medium text-[#aaa08e]">—</p>
      )}
      {todayEnabled ? (
        <button
          type="button"
          onClick={onToday}
          className="shrink-0 text-[9px] font-extrabold text-[#003749] underline decoration-[#dbb878]/70 underline-offset-2 hover:text-[#dbb878]"
        >
          اليوم
        </button>
      ) : null}
    </div>
  );
}

/**
 * تاريخ بصيغة DD-MM-YY + تقويم مخصص (ذهبي / تركواز).
 */
export function DdMmYyDateWithPicker({
  id,
  value,
  onChange,
  onBlur,
  nativeYmd,
  onCalendarSelect,
  minYmd,
  maxYmd,
  disabled,
  readOnly,
  required,
  placeholder = "DD-MM-YY",
  inputClassName = "",
  buttonClassName = "",
  rowClassName = "",
  calendarButtonLabel = "فتح التقويم",
}: DdMmYyDateWithPickerProps) {
  const uid = useId();
  const anchorRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const yearScrollRef = useRef<HTMLDivElement>(null);
  const panelId = `${uid}-cal-panel`;
  const suppressOpenFromFocusRef = useRef(false);
  const pickerLocked = Boolean(disabled || readOnly);

  const [open, setOpen] = useState(false);
  const [calView, setCalView] = useState<CalView>("day");
  const [panelView, setPanelView] = useState(() => {
    const t = new Date();
    return new Date(t.getFullYear(), t.getMonth(), 1);
  });
  const [panelStyle, setPanelStyle] = useState<React.CSSProperties>({});

  const syncViewFromNative = useCallback(() => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(nativeYmd)) {
      const [y, mo] = nativeYmd.split("-").map(Number);
      setPanelView(new Date(y, mo - 1, 1));
    } else {
      const t = new Date();
      setPanelView(new Date(t.getFullYear(), t.getMonth(), 1));
    }
  }, [nativeYmd]);

  const updatePanelPosition = useCallback(() => {
    const el = anchorRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const panelW = Math.min(PANEL_WIDTH, vw - 16);

    // محاذاة لبداية الحقل (جانب زر التقويم في RTL) — لا توسيط على عرض الإدخال الكامل
    let left = r.left;
    if (left + panelW > vw - 8) left = vw - 8 - panelW;
    if (left < 8) left = 8;

    const spaceBelow = vh - r.bottom;
    const spaceAbove = r.top;
    const placeAbove = spaceBelow < PANEL_EST_H && spaceAbove > spaceBelow;

    setPanelStyle({
      position: "fixed",
      top: placeAbove ? Math.max(8, r.top - PANEL_EST_H - 8) : r.bottom + 8,
      left,
      width: panelW,
      maxWidth: panelW,
      zIndex: OVERLAY_PANEL_Z,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePanelPosition();
  }, [open, updatePanelPosition, panelView, calView]);

  useEffect(() => {
    if (!open) return;
    const onScroll = () => updatePanelPosition();
    const onResize = () => updatePanelPosition();
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, updatePanelPosition]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  const vy = panelView.getFullYear();
  const vm = panelView.getMonth();

  useEffect(() => {
    if (!open || calView !== "year" || !yearScrollRef.current) return;
    const btn = yearScrollRef.current.querySelector(`[data-year="${vy}"]`);
    if (btn && "scrollIntoView" in btn) {
      btn.scrollIntoView({ block: "center", behavior: "smooth" });
    }
  }, [open, calView, vy]);

  function openPanel() {
    if (pickerLocked) return;
    syncViewFromNative();
    setCalView("day");
    setOpen(true);
  }

  function handleTextFocus() {
    if (pickerLocked) return;
    if (suppressOpenFromFocusRef.current) return;
    openPanel();
  }

  function handleSelectDay(ymd: string) {
    if (!ymdInRange(ymd, minYmd, maxYmd)) return;
    suppressOpenFromFocusRef.current = true;
    onCalendarSelect(ymd);
    setOpen(false);
    window.setTimeout(() => {
      suppressOpenFromFocusRef.current = false;
    }, 400);
  }

  const cells = buildMonthCells(vy, vm);
  const { start: yearStart, end: yearEnd } = deriveYearBounds(minYmd, maxYmd);
  const yearOptions: number[] = [];
  for (let y = yearEnd; y >= yearStart; y--) yearOptions.push(y);

  const headerPickerBtn =
    "inline-flex items-center justify-center gap-px rounded-md border border-[#ebe4d3]/90 bg-white px-1.5 py-0.5 text-[10px] font-extrabold text-[#003749] outline-none transition-all hover:border-[#dbb878]/55 hover:bg-[#fffdf8] focus-visible:ring-1 focus-visible:ring-[#dbb878]/40";

  const today = new Date();
  const todayYmd = toYmd(today.getFullYear(), today.getMonth(), today.getDate());
  const todaySelectable = ymdInRange(todayYmd, minYmd, maxYmd);
  const hasValidSelection = /^\d{4}-\d{2}-\d{2}$/.test(nativeYmd);

  let panelBody: ReactNode = null;

  if (calView === "day") {
    panelBody = (
      <>
        <div className="mb-1 flex items-center justify-between gap-0.5" dir="ltr">
          <button
            type="button"
            className={navBtnClass}
            aria-label="الشهر السابق"
            onClick={() => setPanelView(new Date(vy, vm - 1, 1))}
          >
            <ChevronLeft className="size-3" aria-hidden />
          </button>
          <div className="flex min-w-0 flex-1 items-center justify-center gap-1.5" dir="rtl">
            <button
              type="button"
              className={headerPickerBtn}
              aria-label="اختيار الشهر"
              onClick={() => setCalView("month")}
            >
              <span>{monthNameAr(vm, true)}</span>
              <ChevronDown className="size-2.5 shrink-0 text-[#dbb878]" aria-hidden />
            </button>
            <button
              type="button"
              className={`${headerPickerBtn} tabular-nums`}
              aria-label="اختيار السنة"
              dir="ltr"
              onClick={() => setCalView("year")}
            >
              <span>{vy}</span>
              <ChevronDown className="size-2.5 shrink-0 text-[#dbb878]" aria-hidden />
            </button>
          </div>
          <button
            type="button"
            className={navBtnClass}
            aria-label="الشهر التالي"
            onClick={() => setPanelView(new Date(vy, vm + 1, 1))}
          >
            <ChevronRight className="size-3" aria-hidden />
          </button>
        </div>
        <div className="grid grid-cols-7 gap-px text-center" dir="ltr">
          {WEEKDAY_LABELS_AR.map((w) => (
            <div
              key={w}
              className="pb-px text-[8px] font-bold leading-none text-[#003749]/40"
            >
              {w}
            </div>
          ))}
          {cells.map((d, i) => {
            if (d == null) {
              return <div key={`e-${i}`} className="h-6" />;
            }
            const ymd = toYmd(vy, vm, d);
            const disabledDay = !ymdInRange(ymd, minYmd, maxYmd);
            const selected = nativeYmd === ymd;
            const isToday = ymd === todayYmd;
            return (
              <button
                key={ymd}
                type="button"
                disabled={disabledDay}
                onClick={() => handleSelectDay(ymd)}
                aria-label={formatYmdDisplayAr(ymd) ?? ymd}
                aria-current={selected ? "date" : undefined}
                className={`flex h-6 w-full items-center justify-center rounded-md text-[10px] font-extrabold tabular-nums outline-none transition-all focus-visible:ring-1 focus-visible:ring-[#dbb878]/45 disabled:cursor-not-allowed disabled:opacity-30 ${
                  selected
                    ? "bg-gradient-to-br from-[#003749] to-[#0a4d63] text-white shadow-sm ring-1 ring-[#dbb878]/40"
                    : isToday
                      ? "bg-[#dbb878]/15 text-[#003749] ring-1 ring-[#dbb878]/50 hover:bg-[#dbb878]/25"
                      : "text-[#0f1923] hover:bg-white hover:shadow-sm"
                }`}
              >
                {d}
              </button>
            );
          })}
        </div>
      </>
    );
  } else if (calView === "month") {
    panelBody = (
      <>
        <p className="mb-1 text-center text-[10px] font-bold text-[#8a7752]" dir="rtl">
          سنة{" "}
          <button
            type="button"
            className="font-extrabold text-[#003749] underline decoration-[#dbb878]/60 underline-offset-2"
            onClick={() => setCalView("year")}
          >
            {vy}
          </button>
        </p>
        <div className="grid grid-cols-4 gap-px" dir="rtl">
          {Array.from({ length: 12 }, (_, m) => {
            const disabledMonth = !monthHasSelectableDay(vy, m, minYmd, maxYmd);
            const isCurrent = m === vm;
            const isSelectedMonth =
              hasValidSelection && nativeYmd.startsWith(`${vy}-${pad2(m + 1)}-`);
            return (
              <button
                key={m}
                type="button"
                disabled={disabledMonth}
                onClick={() => {
                  setPanelView(new Date(vy, m, 1));
                  setCalView("day");
                }}
                className={`rounded-md px-1 py-1.5 text-[10px] font-extrabold outline-none transition-all focus-visible:ring-1 focus-visible:ring-[#dbb878]/45 disabled:cursor-not-allowed disabled:opacity-30 ${
                  isCurrent
                    ? "bg-[#003749] text-white shadow-sm"
                    : isSelectedMonth
                      ? "border-2 border-[#dbb878] bg-[#fffdf8] text-[#003749]"
                      : "border border-[#ebe4d3]/80 bg-white text-[#003749] hover:border-[#dbb878]/50 hover:shadow-sm"
                }`}
              >
                {monthNameAr(m, true)}
              </button>
            );
          })}
        </div>
      </>
    );
  } else {
    panelBody = (
      <div
        ref={yearScrollRef}
        className="max-h-[132px] overflow-y-auto overscroll-contain rounded-md border border-[#ebe4d3]/70 bg-white/60 p-0.5 shadow-inner"
        dir="ltr"
      >
        <div className="grid grid-cols-4 gap-px">
          {yearOptions.map((y) => {
            const disabledYear = !yearHasSelectableDay(y, minYmd, maxYmd);
            const isCurrent = y === vy;
            const isSelectedYear = hasValidSelection && nativeYmd.startsWith(`${y}-`);
            return (
              <button
                key={y}
                type="button"
                data-year={y}
                disabled={disabledYear}
                onClick={() => {
                  setPanelView(new Date(y, vm, 1));
                  setCalView("month");
                }}
                className={`rounded-md py-1 text-[11px] font-extrabold tabular-nums outline-none transition-all focus-visible:ring-1 focus-visible:ring-[#dbb878]/45 disabled:cursor-not-allowed disabled:opacity-30 ${
                  isCurrent
                    ? "bg-[#003749] text-white shadow-sm"
                    : isSelectedYear
                      ? "border-2 border-[#dbb878] bg-[#fffdf8] text-[#003749]"
                      : "bg-white text-[#003749] hover:bg-[#fffdf8] hover:ring-1 hover:ring-[#dbb878]/40"
                }`}
              >
                {y}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  const portal =
    open && typeof document !== "undefined"
      ? createPortal(
          <>
            <div
              className="fixed inset-0 bg-[#003749]/10 backdrop-blur-[1px]"
              style={{ zIndex: OVERLAY_BACKDROP_Z }}
              aria-hidden
              onMouseDown={() => setOpen(false)}
            />
            <div
              ref={panelRef}
              id={panelId}
              role="dialog"
              aria-modal="true"
              aria-label={calendarButtonLabel}
              style={panelStyle}
              onMouseDown={(e) => e.preventDefault()}
              className="w-[252px] max-w-[calc(100vw-1rem)] rounded-lg border border-[#ebe4d3]/90 bg-gradient-to-b from-[#fffdf8] to-[#fdfbf6] p-2 shadow-[0_20px_48px_-18px_rgba(15,61,71,0.18)] ring-1 ring-[#dbb878]/12"
            >
              <ViewPills calView={calView} onChange={setCalView} />

              <div key={calView}>
                {panelBody}
              </div>

              <PanelFooter
                nativeYmd={nativeYmd}
                todayEnabled={todaySelectable && calView === "day"}
                onToday={() => {
                  setPanelView(new Date(today.getFullYear(), today.getMonth(), 1));
                  if (todaySelectable) handleSelectDay(todayYmd);
                }}
              />
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <>
      <div
        ref={anchorRef}
        className={`flex items-stretch overflow-hidden rounded-lg border bg-white shadow-sm transition-[border-color,box-shadow] ${
          open
            ? "border-[#dbb878]/70 ring-2 ring-[#dbb878]/25"
            : hasValidSelection
              ? "border-[#ebe4d3]/90"
              : "border-[#ebe4d3]/90 focus-within:border-[#dbb878]/50 focus-within:ring-2 focus-within:ring-[#dbb878]/20"
        } ${rowClassName}`.trim()}
      >
        <div className="relative min-w-0 flex-1">
          <input
            id={id}
            type="text"
            inputMode="numeric"
            autoComplete="off"
            placeholder={placeholder}
            value={value}
            onChange={onChange}
            onFocus={handleTextFocus}
            onBlur={onBlur}
            required={required}
            disabled={disabled}
            readOnly={readOnly}
            dir="ltr"
            aria-describedby={hasValidSelection ? `${id}-picked` : undefined}
            className={`min-w-0 w-full border-0 bg-transparent px-2 py-1.5 text-[12px] font-semibold tabular-nums text-[#003749] outline-none placeholder:text-[#aaa08e]/80 disabled:cursor-not-allowed disabled:opacity-60 read-only:opacity-90 ${inputClassName}`.trim()}
          />
          {hasValidSelection ? (
            <span id={`${id}-picked`} className="sr-only">
              {formatYmdDisplayAr(nativeYmd)}
            </span>
          ) : null}
        </div>
        <button
          type="button"
          onClick={() => {
            if (pickerLocked) return;
            if (open) setOpen(false);
            else openPanel();
          }}
          disabled={pickerLocked}
          aria-label={calendarButtonLabel}
          title={calendarButtonLabel}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          className={`flex shrink-0 items-center justify-center border-s border-[#ebe4d3]/80 px-2 outline-none transition-colors focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-[#dbb878]/40 disabled:pointer-events-none disabled:opacity-45 ${
            open ? "bg-[#dbb878]/15 text-[#003749]" : "bg-[#fdfbf6] text-[#003749] hover:bg-[#dbb878]/10"
          } ${buttonClassName}`.trim()}
        >
          <CalendarDays className={`size-3.5 ${open ? "text-[#c9a356]" : ""}`} aria-hidden />
        </button>
      </div>
      {portal}
    </>
  );
}
