"use client";

import { useLocale } from "next-intl";
import { useRouter, usePathname } from "@/i18n/routing";
import { useTransition } from "react";

export function LanguageSwitcher({ variant = "light" }: { variant?: "light" | "dark" }) {
  const [isPending, startTransition] = useTransition();
  const locale = useLocale();
  const router = useRouter();
  const pathname = usePathname();

  const target = locale === "ar" ? "en" : "ar";
  // The label is always written in the target language: a visitor looking
  // for English must be able to read the button without knowing Arabic.
  const label = target === "en" ? "English" : "عربي";
  const ariaLabel = target === "en" ? "Switch to English" : "التبديل إلى العربية";

  function switchLocale() {
    if (isPending) return;
    // window.location.search keeps filters/query params across the switch
    // (usePathname strips them); read lazily to avoid a useSearchParams
    // Suspense boundary requirement.
    const search = typeof window !== "undefined" ? window.location.search : "";
    startTransition(() => {
      router.replace(`${pathname}${search}`, { locale: target });
    });
  }

  return (
    <button
      type="button"
      onClick={switchLocale}
      disabled={isPending}
      aria-label={ariaLabel}
      dir={target === "en" ? "ltr" : "rtl"}
      className={`relative flex h-9 shrink-0 cursor-pointer items-center gap-1.5 rounded-full border border-[#dbb878]/50 bg-[#dbb878]/10 px-3.5 text-xs font-bold tracking-wide backdrop-blur transition-all duration-200 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[#dbb878] sm:px-4 ${
        isPending ? "pointer-events-none opacity-50" : ""
      } ${
        variant === "light"
          ? "text-[#003749] hover:bg-[#dbb878]/25"
          : "text-white hover:bg-white/10 hover:text-[#dbb878]"
      }`}
    >
      <span className={`flex items-center gap-1.5 ${isPending ? "invisible" : ""}`}>
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={1.8}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-4 w-4"
          aria-hidden
        >
          <circle cx="12" cy="12" r="9" />
          <path d="M3.6 9h16.8M3.6 15h16.8M12 3a17 17 0 0 1 0 18M12 3a17 17 0 0 0 0 18" />
        </svg>
        {label}
      </span>
      {isPending && (
        <span aria-hidden className="absolute inset-0 flex items-center justify-center">
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-[#dbb878] border-t-transparent" />
        </span>
      )}
    </button>
  );
}
