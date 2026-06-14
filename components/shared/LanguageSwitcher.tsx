"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { useTransition } from "react";

const LOCALES = [
  { value: "ar", label: "ع" },
  { value: "en", label: "EN" },
] as const;

export function LanguageSwitcher() {
  const [isPending, startTransition] = useTransition();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  function switchTo(next: string) {
    if (next === locale || isPending) return;
    startTransition(() => {
      router.replace(pathname, { locale: next });
    });
  }

  return (
    <div
      role="group"
      aria-label="اختيار اللغة / Language"
      className={`relative flex h-9 items-center rounded-full border border-[#dbb878]/40 bg-[#dbb878]/10 p-0.5 backdrop-blur transition-opacity duration-200 ${isPending ? "opacity-50 pointer-events-none" : ""}`}
    >
      {isPending && (
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center"
        >
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#dbb878] border-t-transparent" />
        </span>
      )}
      {LOCALES.map(({ value, label }) => {
        const isActive = locale === value;
        return (
          <button
            key={value}
            type="button"
            aria-pressed={isActive}
            aria-label={value === "ar" ? "العربية" : "English"}
            onClick={() => switchTo(value)}
            disabled={isPending}
            className={`relative z-10 h-8 min-w-[2.25rem] cursor-pointer rounded-full px-2.5 text-xs font-bold tracking-wide transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#dbb878] ${
              isActive
                ? "bg-[#163332] text-[#dbb878] shadow-[0_2px_8px_rgba(22,51,50,0.4)]"
                : "text-[#2a2520] hover:text-[#163332] hover:bg-[#dbb878]/20"
            }`}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}
