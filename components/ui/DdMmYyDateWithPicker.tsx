"use client";

import { CalendarDays } from "lucide-react";
import { useRef } from "react";

export type DdMmYyDateWithPickerProps = {
  id: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur: () => void;
  /** YYYY-MM-DD لمزامنة `input[type=date]` المخفي */
  nativeYmd: string;
  onCalendarSelect: (ymd: string) => void;
  minYmd?: string;
  maxYmd?: string;
  disabled?: boolean;
  readOnly?: boolean;
  required?: boolean;
  placeholder?: string;
  /** على حقل النص الظاهر */
  inputClassName?: string;
  /** على زر التقويم */
  buttonClassName?: string;
  /** على الحاوية */
  rowClassName?: string;
  calendarButtonLabel?: string;
};

/**
 * تاريخ بصيغة DD-MM-YY في حقل نص + زر يفتح منتقي التاريخ الأصلي للمتصفح (تقويم).
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
  const nativeRef = useRef<HTMLInputElement>(null);
  const pickerLocked = Boolean(disabled || readOnly);

  function openCalendar() {
    if (pickerLocked) return;
    const el = nativeRef.current;
    if (!el) return;
    try {
      const sp = (el as HTMLInputElement & { showPicker?: () => Promise<void> }).showPicker;
      if (typeof sp === "function") {
        void sp.call(el);
        return;
      }
    } catch {
      /* continue fallbacks */
    }
    try {
      el.focus();
    } catch {
      /* ignore */
    }
    try {
      el.click();
    } catch {
      /* ignore */
    }
  }

  return (
    <div className={`flex items-stretch gap-1 ${rowClassName}`.trim()}>
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        required={required}
        disabled={disabled}
        readOnly={readOnly}
        dir="ltr"
        className={
          `min-w-0 flex-1 rounded-md border border-[#ebe4d3]/80 bg-white/80 px-2 py-1 text-[13px] font-semibold tabular-nums text-[#0f1923] outline-none placeholder:text-[#aaa08e]/85 focus-visible:ring-2 focus-visible:ring-[#dbb878]/30 disabled:cursor-not-allowed disabled:opacity-60 read-only:opacity-90 ${inputClassName}`.trim()
        }
      />
      <button
        type="button"
        onClick={openCalendar}
        disabled={pickerLocked}
        aria-label={calendarButtonLabel}
        title={calendarButtonLabel}
        className={
          `flex shrink-0 items-center justify-center rounded-md border border-[#ebe4d3]/80 bg-[#fdfbf6] px-2.5 text-[#003749] outline-none transition-colors hover:border-[#dbb878]/60 hover:bg-[#fffdf8] focus-visible:ring-2 focus-visible:ring-[#dbb878]/35 disabled:pointer-events-none disabled:opacity-45 ${buttonClassName}`.trim()
        }
      >
        <CalendarDays className="size-4" aria-hidden />
      </button>
      <input
        ref={nativeRef}
        type="date"
        value={nativeYmd}
        min={minYmd}
        max={maxYmd}
        onChange={(e) => {
          const v = e.target.value;
          if (v) onCalendarSelect(v);
        }}
        tabIndex={-1}
        aria-hidden
        className="sr-only"
      />
    </div>
  );
}
