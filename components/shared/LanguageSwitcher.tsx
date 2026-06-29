"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { useTransition, useRef, useState, useEffect } from "react";

const LOCALES = [
  { value: "ar", label: "العربية" },
  { value: "en", label: "English" },
] as const;

/** Globe SVG — matches the Material Symbols "language" icon style */
function GlobeIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  );
}

export function LanguageSwitcher({ variant = "light" }: { variant?: "light" | "dark" }) {
  const [isPending, startTransition] = useTransition();
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const ref = useRef<HTMLDivElement>(null);

  function switchTo(next: string) {
    if (next === locale || isPending) return;
    setDropdownOpen(false);
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [dropdownOpen]);

  const isLight = variant === "light";

  return (
    <div ref={ref} className="relative">
      {/* Globe trigger button */}
      <button
        type="button"
        onClick={() => setDropdownOpen((v) => !v)}
        aria-label="تغيير اللغة / Switch language"
        aria-expanded={dropdownOpen}
        disabled={isPending}
        className={`relative flex h-9 w-9 items-center justify-center rounded-full transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#dbb878] ${
          isPending
            ? "pointer-events-none opacity-50"
            : isLight
            ? "text-[#4e453a] hover:bg-[#003749]/8 hover:text-[#003749]"
            : "text-white/80 hover:bg-white/10 hover:text-white"
        }`}
      >
        {isPending ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" aria-hidden />
        ) : (
          <GlobeIcon className="h-5 w-5" />
        )}
      </button>

      {/* Dropdown */}
      {dropdownOpen && (
        <div
          className={`absolute end-0 top-full z-[100] mt-2 w-36 overflow-hidden rounded-xl border shadow-[0_8px_32px_rgba(0,0,0,0.12)] ${
            isLight
              ? "border-[#e5e2dc] bg-white"
              : "border-white/15 bg-[#003749]"
          }`}
          role="listbox"
          aria-label="اختيار اللغة"
        >
          {LOCALES.map(({ value, label }) => {
            const isActive = locale === value;
            return (
              <button
                key={value}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => switchTo(value)}
                className={`flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-bold transition-colors ${
                  isActive
                    ? isLight
                      ? "bg-[#003749]/6 text-[#003749]"
                      : "bg-white/10 text-[#dbb878]"
                    : isLight
                    ? "text-[#4e453a] hover:bg-[#003749]/5 hover:text-[#003749]"
                    : "text-white/80 hover:bg-white/10 hover:text-white"
                }`}
              >
                {/* Active tick */}
                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${isActive ? (isLight ? "bg-[#003749]" : "bg-[#dbb878]") : "invisible"}`} />
                {label}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
