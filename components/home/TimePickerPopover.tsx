"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarX2, Clock, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useAnchoredPopoverPosition } from "@/lib/use-anchored-popover-position";
import { parseDdMmYyToYmd } from "@/lib/booking-search-shared";
import {
  parseHmToMinutes,
  scheduleHasAnyRule,
  type BranchOpeningHoursSchedule,
} from "@/lib/branch-opening-hours";

type Props = {
  isOpen: boolean;
  onClose: () => void;
  label: string;
  time: string;
  onConfirm: (time: string) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  readOnly?: boolean;
  /** مواعيد الفرع — الأوقات خارجها لا تُعرض. null = بدون قيود (24 ساعة) */
  schedule?: BranchOpeningHoursSchedule | null;
  /** تاريخ اليوم المختار (DD-MM-YY) لتحديد مواعيد يوم الأسبوع */
  dateDdMmYy?: string;
};

const SLOT_STEP_MINUTES = 30;

type DayBounds =
  | { kind: "unrestricted" }
  | { kind: "closed" }
  | { kind: "range"; openM: number; closeM: number };

function resolveDayBounds(
  schedule: BranchOpeningHoursSchedule | null | undefined,
  dateDdMmYy: string | undefined,
): DayBounds {
  if (!schedule || !scheduleHasAnyRule(schedule)) return { kind: "unrestricted" };
  const ymd = dateDdMmYy ? parseDdMmYyToYmd(dateDdMmYy) : null;
  if (!ymd) return { kind: "unrestricted" };
  const [y, m, d] = ymd.split("-").map(Number);
  const weekday = new Date(y, m - 1, d).getDay();
  const row = schedule.days[String(weekday)];
  if (!row || row.closed === true) return { kind: "closed" };
  const openM = row.open ? parseHmToMinutes(row.open) : null;
  const closeM = row.close ? parseHmToMinutes(row.close) : null;
  if (openM == null || closeM == null || openM >= closeM) return { kind: "closed" };
  return { kind: "range", openM, closeM };
}

function minutesToHm(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function formatSlotLabel(hm: string, isAr: boolean): string {
  const mins = parseHmToMinutes(hm);
  if (mins == null) return hm;
  const h24 = Math.floor(mins / 60);
  const m = mins % 60;
  const h12 = h24 % 12 === 0 ? 12 : h24 % 12;
  const suffix = isAr ? (h24 < 12 ? "ص" : "م") : h24 < 12 ? "AM" : "PM";
  return `${h12}:${String(m).padStart(2, "0")} ${suffix}`;
}

/** فترات اليوم — مثل تقسيم SIXT (Morning / Afternoon / Evening) */
function periodGroups(isAr: boolean): { label: string; fromM: number; toM: number }[] {
  return [
    { label: isAr ? "الفجر" : "Early morning", fromM: 0, toM: 299 },
    { label: isAr ? "الصباح" : "Morning", fromM: 300, toM: 719 },
    { label: isAr ? "الظهيرة" : "Afternoon", fromM: 720, toM: 1019 },
    { label: isAr ? "المساء" : "Evening", fromM: 1020, toM: 1439 },
  ];
}

export function TimePickerPopover({
  isOpen,
  onClose,
  label,
  time,
  onConfirm,
  anchorRef,
  readOnly = false,
  schedule = null,
  dateDdMmYy,
}: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const timeListRef = useRef<HTMLDivElement>(null);
  const t = useTranslations("Common");
  const locale = useLocale();
  const isAr = locale === "ar";
  const [selectedTime, setSelectedTime] = useState(time || "09:00");

  useEffect(() => {
    if (!isOpen) return;
    setSelectedTime(time || "09:00");
  }, [isOpen, time]);

  const bounds = useMemo(
    () => resolveDayBounds(schedule, dateDdMmYy),
    [schedule, dateDdMmYy],
  );

  const allowedSlots = useMemo(() => {
    if (bounds.kind === "closed") return [];
    const out: number[] = [];
    for (let m = 0; m < 24 * 60; m += SLOT_STEP_MINUTES) {
      if (bounds.kind === "range" && (m < bounds.openM || m > bounds.closeM)) continue;
      out.push(m);
    }
    return out;
  }, [bounds]);

  const groups = useMemo(
    () =>
      periodGroups(isAr)
        .map((g) => ({
          label: g.label,
          slots: allowedSlots.filter((m) => m >= g.fromM && m <= g.toM),
        }))
        .filter((g) => g.slots.length > 0),
    [allowedSlots, isAr],
  );

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

  function handleSelect(hm: string) {
    if (readOnly) return;
    setSelectedTime(hm);
    onConfirm(hm);
    onClose();
  }

  const { style: panelStyle, ready: panelReady } = useAnchoredPopoverPosition(
    isOpen,
    anchorRef,
    panelRef,
    { panelWidth: 292 },
  );

  if (!isOpen || !panelReady || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={panelRef}
      role="dialog"
      aria-label={`${t("select")} ${label}`}
      style={panelStyle}
      className="datetime-popover flex flex-col overflow-hidden rounded-2xl border border-[#ebe4d3] bg-white shadow-[0_20px_60px_-10px_rgba(0,55,73,0.22),0_4px_16px_-4px_rgba(0,55,73,0.12)]"
      dir={isAr ? "rtl" : "ltr"}
    >
      <div className="flex items-center justify-between border-b border-[#f0ebe4] bg-gradient-to-l from-[#fdfbf6] to-[#f9f5ee] px-4 py-3">
        <span className="text-[13.5px] font-extrabold text-[#003749]">
          {t("select")} {label}
        </span>
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
        <p className="px-3 py-4 text-center text-[11px] font-semibold text-[#aaa08e]">
          الوقت محدد آلياً
        </p>
      ) : bounds.kind === "closed" ? (
        <div className="flex flex-col items-center gap-2 px-4 py-6 text-center">
          <CalendarX2 className="size-7 text-[#c9a356]" aria-hidden />
          <p className="text-[12.5px] font-bold leading-relaxed text-[#3a2f1e]">
            {isAr
              ? "الفرع مغلق في هذا اليوم — اختر تاريخاً آخر أو فرعاً آخر."
              : "The branch is closed on this day — pick another date or branch."}
          </p>
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1.5 border-b border-[#f0ebe4] px-4 py-2.5">
            <Clock className="size-3.5 shrink-0 text-[#dbb878]" aria-hidden />
            <span className="text-[11.5px] font-bold text-[#6b5a3b]">
              {bounds.kind === "unrestricted" ? (
                isAr ? "متاح على مدار 24 ساعة" : "24-hour availability"
              ) : (
                <>
                  {isAr ? "مواعيد الفرع:" : "Branch hours:"}{" "}
                  <span dir="ltr" className="tabular-nums">
                    {formatSlotLabel(minutesToHm(bounds.openM), isAr)}
                    {" – "}
                    {formatSlotLabel(minutesToHm(bounds.closeM), isAr)}
                  </span>
                </>
              )}
            </span>
          </div>
          <div ref={timeListRef} className="max-h-[300px] overflow-y-auto px-3 py-2.5">
            {groups.map((g) => (
              <div key={g.label} className="mb-1.5">
                <p className="mb-1.5 mt-1 px-1 text-[11px] font-extrabold text-[#003749]/70">
                  {g.label}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  {g.slots.map((m) => {
                    const hm = minutesToHm(m);
                    const isActive = hm === selectedTime;
                    return (
                      <button
                        key={hm}
                        type="button"
                        data-active={isActive}
                        onClick={() => handleSelect(hm)}
                        dir="ltr"
                        className={`rounded-lg py-2.5 text-center text-[12.5px] font-bold tabular-nums transition-all
                          ${
                            isActive
                              ? "bg-gradient-to-r from-[#dbb878] to-[#c9a356] text-white shadow-sm"
                              : "bg-[#f7f3ea] text-[#3a2f1e] hover:bg-[#efe7d6]"
                          }`}
                      >
                        {formatSlotLabel(hm, isAr)}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>,
    document.body,
  );
}
