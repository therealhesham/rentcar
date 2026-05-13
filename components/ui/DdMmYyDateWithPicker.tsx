"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import {
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";

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

/** عربية السعودية مع تقويم ميلادي صريح (بدون عرض هجري من المتصفح) */
const AR_LOCALE_GREGORY = "ar-SA-u-ca-gregory";

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
  while (cells.length < 42) cells.push(null);
  return cells;
}

function ymdInRange(ymd: string, minYmd?: string, maxYmd?: string): boolean {
  if (minYmd && ymd < minYmd) return false;
  if (maxYmd && ymd > maxYmd) return false;
  return true;
}

function monthTitleAr(viewYear: number, viewMonth0: number): string {
  return new Date(viewYear, viewMonth0, 1).toLocaleDateString(AR_LOCALE_GREGORY, {
    month: "long",
    year: "numeric",
  });
}

/**
 * تاريخ بصيغة DD-MM-YY في حقل نص + تقويم مخصص بنفس هوية الـ widget (ذهبي / تركواز).
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
  const panelId = `${uid}-cal-panel`;
  const suppressOpenFromFocusRef = useRef(false);
  const pickerLocked = Boolean(disabled || readOnly);

  const [open, setOpen] = useState(false);
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
    const panelW = Math.min(Math.max(r.width, 272), vw - 16);
    let left = r.left + (r.width - panelW) / 2;
    if (left + panelW > vw - 8) left = vw - 8 - panelW;
    if (left < 8) left = 8;
    setPanelStyle({
      position: "fixed",
      top: r.bottom + 6,
      left,
      width: panelW,
      zIndex: 70,
    });
  }, []);

  useLayoutEffect(() => {
    if (!open) return;
    updatePanelPosition();
  }, [open, updatePanelPosition, panelView]);

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

  function openPanel() {
    if (pickerLocked) return;
    syncViewFromNative();
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

  const vy = panelView.getFullYear();
  const vm = panelView.getMonth();
  const cells = buildMonthCells(vy, vm);

  const today = new Date();
  const todayYmd = toYmd(today.getFullYear(), today.getMonth(), today.getDate());

  const portal =
    open && typeof document !== "undefined"
      ? createPortal(
          <>
            <div
              className="fixed inset-0 z-[65] bg-black/[0.04]"
              aria-hidden
              onMouseDown={() => setOpen(false)}
            />
            <div
              id={panelId}
              role="dialog"
              aria-modal="true"
              aria-label={calendarButtonLabel}
              style={panelStyle}
              onMouseDown={(e) => e.preventDefault()}
              className="rounded-xl border border-[#ebe4d3]/90 bg-[#fdfbf6] p-3 shadow-[0_28px_72px_-20px_rgba(15,61,71,0.18),0_8px_24px_-6px_rgba(15,61,71,0.08)] ring-1 ring-black/[0.04]"
            >
              <div className="mb-2 flex items-center justify-between gap-2" dir="ltr">
                <button
                  type="button"
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#ebe4d3]/80 bg-white/90 text-[#003749] outline-none transition-colors hover:border-[#dbb878]/55 hover:bg-[#fffdf8] focus-visible:ring-2 focus-visible:ring-[#dbb878]/35"
                  aria-label="الشهر السابق"
                  onClick={() => setPanelView(new Date(vy, vm - 1, 1))}
                >
                  <ChevronLeft className="size-4" aria-hidden />
                </button>
                <span
                  className="min-w-0 flex-1 text-center text-[13px] font-extrabold text-[#003749]"
                  dir="rtl"
                >
                  {monthTitleAr(vy, vm)}
                </span>
                <button
                  type="button"
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-[#ebe4d3]/80 bg-white/90 text-[#003749] outline-none transition-colors hover:border-[#dbb878]/55 hover:bg-[#fffdf8] focus-visible:ring-2 focus-visible:ring-[#dbb878]/35"
                  aria-label="الشهر التالي"
                  onClick={() => setPanelView(new Date(vy, vm + 1, 1))}
                >
                  <ChevronRight className="size-4" aria-hidden />
                </button>
              </div>
              <div className="grid grid-cols-7 gap-0.5 text-center" dir="ltr">
                {WEEKDAY_LABELS_AR.map((w) => (
                  <div
                    key={w}
                    className="pb-1 text-[10px] font-bold uppercase tracking-wide text-[#003749]/55"
                  >
                    {w}
                  </div>
                ))}
                {cells.map((d, i) => {
                  if (d == null) {
                    return <div key={`e-${i}`} className="min-h-[2rem]" />;
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
                      className={`flex min-h-[2rem] items-center justify-center rounded-lg text-[12px] font-bold tabular-nums outline-none transition-[background-color,box-shadow,color] focus-visible:ring-2 focus-visible:ring-[#dbb878]/40 disabled:cursor-not-allowed disabled:opacity-35 ${selected
                          ? "bg-[#003749] text-white shadow-sm"
                          : isToday
                            ? "border border-[#dbb878]/60 bg-white/80 text-[#003749]"
                            : "text-[#0f1923] hover:bg-white/90"
                        }`}
                    >
                      {d}
                    </button>
                  );
                })}
              </div>
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <>
      <div
        ref={anchorRef}
        className={`flex items-stretch gap-1 ${rowClassName}`.trim()}
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
            className={
              `relative z-0 min-w-0 w-full rounded-md border border-[#ebe4d3]/80 bg-white/80 px-2 py-1 text-[13px] font-semibold tabular-nums text-[#0f1923] outline-none placeholder:text-[#aaa08e]/85 focus-visible:ring-2 focus-visible:ring-[#dbb878]/30 disabled:cursor-not-allowed disabled:opacity-60 read-only:opacity-90 ${inputClassName}`.trim()
            }
          />
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
          className={
            `flex shrink-0 items-center justify-center rounded-md border border-[#ebe4d3]/80 bg-[#fdfbf6] px-2.5 text-[#003749] outline-none transition-colors hover:border-[#dbb878]/60 hover:bg-[#fffdf8] focus-visible:ring-2 focus-visible:ring-[#dbb878]/35 disabled:pointer-events-none disabled:opacity-45 ${buttonClassName}`.trim()
          }
        >
          <CalendarDays className="size-4" aria-hidden />
        </button>
      </div>
      {portal}
    </>
  );
}
