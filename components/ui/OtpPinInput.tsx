"use client";

import {
  useCallback,
  useEffect,
  useId,
  useRef,
  type ClipboardEvent,
  type KeyboardEvent,
} from "react";
import { BOOKING_OTP_LENGTH } from "@/lib/booking-otp-constants";

export type OtpPinInputProps = {
  value: string;
  onChange: (value: string) => void;
  /** يُستدعى عند اكتمال الرمز (4 أرقام). */
  onComplete?: (value: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  id?: string;
  "aria-label"?: string;
  className?: string;
};

function digitsFromValue(value: string, length: number): string[] {
  const clean = value.replace(/\D/g, "").slice(0, length);
  const arr = clean.split("");
  while (arr.length < length) arr.push("");
  return arr;
}

export function OtpPinInput({
  value,
  onChange,
  onComplete,
  disabled = false,
  autoFocus = false,
  id: idProp,
  "aria-label": ariaLabel = "رمز التحقق",
  className = "",
}: OtpPinInputProps) {
  const length = BOOKING_OTP_LENGTH;
  const reactId = useId();
  const groupId = idProp ?? `otp-${reactId}`;
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = digitsFromValue(value, length);

  const emit = useCallback(
    (next: string) => {
      const clean = next.replace(/\D/g, "").slice(0, length);
      onChange(clean);
      if (clean.length === length) {
        onComplete?.(clean);
      }
    },
    [length, onChange, onComplete],
  );

  const focusAt = (index: number) => {
    const i = Math.max(0, Math.min(length - 1, index));
    refs.current[i]?.focus();
    refs.current[i]?.select();
  };

  useEffect(() => {
    if (autoFocus && !disabled) {
      focusAt(0);
    }
  }, [autoFocus, disabled]);

  function handleDigitChange(index: number, raw: string) {
    const d = raw.replace(/\D/g, "");
    if (!d) {
      const next = digits.map((x, i) => (i === index ? "" : x)).join("");
      emit(next);
      return;
    }
    if (d.length > 1) {
      const merged = (digits.join("") + d).replace(/\D/g, "").slice(0, length);
      emit(merged);
      focusAt(Math.min(merged.length, length - 1));
      return;
    }
    const nextArr = [...digits];
    nextArr[index] = d[0];
    const merged = nextArr.join("");
    emit(merged);
    if (index < length - 1) focusAt(index + 1);
  }

  function handleKeyDown(index: number, e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Backspace") {
      if (digits[index]) {
        const nextArr = [...digits];
        nextArr[index] = "";
        emit(nextArr.join(""));
      } else if (index > 0) {
        e.preventDefault();
        focusAt(index - 1);
        const nextArr = [...digits];
        nextArr[index - 1] = "";
        emit(nextArr.join(""));
      }
      return;
    }
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      focusAt(index - 1);
      return;
    }
    if (e.key === "ArrowRight") {
      e.preventDefault();
      focusAt(index + 1);
      return;
    }
    if (e.key === "Home") {
      e.preventDefault();
      focusAt(0);
    }
    if (e.key === "End") {
      e.preventDefault();
      focusAt(length - 1);
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, length);
    if (!pasted) return;
    emit(pasted);
    focusAt(Math.min(pasted.length, length - 1));
  }

  return (
    <div className={className}>
      <div
        id={groupId}
        role="group"
        aria-label={ariaLabel}
        dir="ltr"
        className="flex items-center justify-center gap-2.5 sm:gap-3"
      >
        {digits.map((digit, index) => (
          <input
            key={index}
            ref={(el) => {
              refs.current[index] = el;
            }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            maxLength={1}
            value={digit}
            disabled={disabled}
            autoComplete={index === 0 ? "one-time-code" : "off"}
            aria-label={`${ariaLabel} — رقم ${index + 1}`}
            className={`size-12 sm:size-14 rounded-xl border-2 bg-white text-center text-[22px] font-extrabold tabular-nums text-[#003749] outline-none transition-[border-color,box-shadow,transform] sm:text-[26px] ${
              disabled
                ? "cursor-not-allowed border-[#ebe4d3]/80 bg-[#f9f7f3] opacity-60"
                : digit
                  ? "border-[#dbb878] shadow-[0_0_0_3px_rgba(219,184,120,0.2)]"
                  : "border-[#ebe4d3] hover:border-[#dbb878]/50"
            } focus:border-[#dbb878] focus:shadow-[0_0_0_4px_rgba(219,184,120,0.28)] focus:scale-[1.02]`}
            onChange={(ev) => handleDigitChange(index, ev.target.value)}
            onKeyDown={(ev) => handleKeyDown(index, ev)}
            onPaste={handlePaste}
            onFocus={(ev) => ev.target.select()}
          />
        ))}
      </div>
    </div>
  );
}
