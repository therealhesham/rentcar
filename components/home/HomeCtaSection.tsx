"use client";

import Link from "next/link";
import { ArrowLeft, ArrowRight, CalendarCheck } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { Reveal } from "./HomeMotion";

export function HomeCtaSection() {
  const t = useTranslations("HomeCta");
  const commonT = useTranslations("Common");
  const locale = useLocale();
  const isRtl = locale === "ar";
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  return (
    <section
      aria-label={t("ariaLabel")}
      className="relative overflow-hidden bg-[#003749] px-4 py-14 sm:px-8 sm:py-20"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <CtaDecorations />

      <Reveal className="relative z-[1] mx-auto max-w-screen-xl text-center">
        <div className="mb-4 flex items-center justify-center gap-3">
          <span className="h-px w-10 bg-gradient-to-l from-[#dbb878]/60 to-transparent sm:w-14" />
          <span className="text-xs sm:text-[13.5px] font-black uppercase tracking-[0.22em] text-[#dbb878]">
            {t("readyToGo")}
          </span>
          <span className="h-px w-10 bg-gradient-to-r from-[#dbb878]/60 to-transparent sm:w-14" />
        </div>

        <h2 className="text-balance text-2xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-[2.65rem]">
          {t("bookYourCarInMinutes")}
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-sm font-medium leading-relaxed text-white/75 sm:text-base">
          {t("ctaDescription")}
        </p>

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:mt-10 sm:flex-row sm:gap-4">
          <a
            href="#home-booking"
            className="inline-flex min-h-[48px] w-full max-w-xs items-center justify-center gap-2 rounded-full bg-[#dbb878] px-8 py-3 text-sm font-extrabold text-[#1a1408] shadow-[0_12px_32px_-8px_rgba(219,184,120,0.55)] transition-all hover:-translate-y-0.5 hover:bg-[#e8c992] hover:shadow-[0_16px_40px_-8px_rgba(219,184,120,0.65)] sm:w-auto"
          >
            <CalendarCheck className="size-4 shrink-0" aria-hidden />
            {commonT("bookNow")}
          </a>
          <Link
            href="/fleet"
            className="group inline-flex min-h-[48px] w-full max-w-xs items-center justify-center gap-2 rounded-full border-2 border-white/25 bg-white/5 px-8 py-3 text-sm font-extrabold text-white backdrop-blur-sm transition-all hover:-translate-y-0.5 hover:border-white/40 hover:bg-white/10 sm:w-auto"
          >
            {t("browseFleet")}
            <ArrowIcon
              className={`size-4 shrink-0 transition-transform ${
                isRtl ? "group-hover:-translate-x-0.5" : "group-hover:translate-x-0.5"
              }`}
              aria-hidden
            />
          </Link>
        </div>
      </Reveal>
    </section>
  );
}

function CtaDecorations() {
  return (
    <>
      <div
        className="pointer-events-none absolute -start-32 top-0 h-72 w-72 rounded-full bg-[#dbb878]/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -end-32 bottom-0 h-72 w-72 rounded-full bg-white/5 blur-3xl"
        aria-hidden
      />
    </>
  );
}
