import Image from "next/image";
import {
  BookingWidget,
  type BookingCityBranchesOption,
} from "./BookingWidget";
import type { BookingWidgetTabFlags } from "@/lib/booking-widget-tabs";
import { HeroEntrance } from "./HomeMotion";

/** مؤقت: عطّل صور الهيرو الجانبية لرفع الـ widget أقرب للـ nav */
const SHOW_HERO_IMAGES = false;

export type HeroProps = {
  leftImageUrl: string;
  leftImageAlt: string;
  rightImageUrl: string;
  rightImageAlt: string;
  cities: BookingCityBranchesOption[];
  tabFlags?: BookingWidgetTabFlags | null;
};

export function Hero({
  leftImageUrl,
  leftImageAlt,
  rightImageUrl,
  rightImageAlt,
  cities,
  tabFlags,
}: HeroProps) {
  const headlineBlock = (
    <div
      dir="rtl"
      className="relative flex flex-col items-center justify-center px-4 py-3 text-center sm:px-6 sm:py-4"
    >
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "radial-gradient(circle, #003749 1px, transparent 1px)",
          backgroundSize: "20px 20px",
        }}
      />

      <div className="relative mb-1.5 flex items-center gap-2 sm:mb-2">
        <span className="h-px w-6 rounded-full bg-gradient-to-l from-[#dbb878] to-transparent sm:w-8" />
        <span className="text-[9px] font-semibold uppercase tracking-[0.18em] text-[#dbb878] sm:text-[10px]">
          خدمة متميزة
        </span>
        <span className="h-px w-6 rounded-full bg-gradient-to-r from-[#dbb878] to-transparent sm:w-8" />
      </div>

      <h1 className="relative text-balance text-base font-bold leading-snug tracking-tight text-[#0f3d47] sm:text-lg md:text-xl">
        روائس لتأجير السيارات
      </h1>

      <p className="relative mt-1.5 max-w-[20rem] text-pretty text-[11px] font-medium leading-relaxed text-[#0f3d47]/55 sm:mt-2 sm:text-xs md:max-w-sm">
        مجموعة واسعة من السيارات لتلبية احتياجاتك بمختلف الفئات والميزانيات.
      </p>

      <div className="relative mt-2 h-px w-8 rounded-full bg-gradient-to-r from-transparent via-[#dbb878]/45 to-transparent sm:mt-2.5" />
    </div>
  );

  return (
    <>
      {SHOW_HERO_IMAGES ? (
        <header className="relative flex flex-col overflow-x-hidden bg-white pt-24 md:pt-28">
          <HeroEntrance className="w-full">
            <div
              className="relative grid w-full grid-cols-1 md:min-h-[min(45vh,22rem)] md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)]"
              dir="ltr"
            >
            <div className="relative aspect-[5/3] w-full overflow-hidden md:aspect-auto md:min-h-[min(52vh,28rem)]">
              <Image
                src={leftImageUrl}
                alt={leftImageAlt}
                fill
                priority
                className="object-cover"
                sizes="(min-width: 768px) 35vw, 100vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0f3d47]/30 via-transparent to-transparent" />
              <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white via-white/70 to-transparent" />
            </div>

            <div className="relative flex min-h-[14rem] flex-col items-center justify-center md:min-h-0">
              {headlineBlock}
            </div>

            <div className="relative aspect-[5/3] w-full overflow-hidden md:aspect-auto md:min-h-[min(52vh,28rem)]">
              <Image
                src={rightImageUrl}
                alt={rightImageAlt}
                fill
                priority
                className="object-cover"
                sizes="(min-width: 768px) 35vw, 100vw"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#0f3d47]/30 via-transparent to-transparent" />
              <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white via-white/70 to-transparent" />
            </div>
            </div>
          </HeroEntrance>
        </header>
      ) : (
        <section className="relative flex flex-col overflow-x-hidden bg-white pt-[4.5rem] sm:pt-24">
          <HeroEntrance className="flex flex-col items-center">
            {headlineBlock}
          </HeroEntrance>
        </section>
      )}

      {/* ─── Booking widget ─── */}
      <div
        className={
          SHOW_HERO_IMAGES
            ? "relative z-30 -mt-8 border-b border-[#ebe4d3]/70 bg-white/92 shadow-[0_8px_28px_-6px_rgba(15,61,71,0.1)] backdrop-blur-md sm:-mt-12 md:-mt-12 lg:-mt-16"
            : "relative z-30 -mt-2 border-b border-[#ebe4d3]/70 bg-white/92 shadow-[0_8px_28px_-6px_rgba(15,61,71,0.1)] backdrop-blur-md sm:-mt-3"
        }
        dir="rtl"
      >
        <div className="mx-auto w-full max-w-[72rem] px-4 pb-3 pt-2.5 sm:px-6 sm:pb-3.5 sm:pt-3 lg:px-8 lg:pb-4">
            <div className="mb-2 flex items-center justify-center gap-3 sm:mb-3">
              <span className="h-px w-12 bg-gradient-to-l from-[#dbb878]/50 to-transparent" />
              <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#003749]/40">
                احجز مركبتك الآن
              </span>
              <span className="h-px w-12 bg-gradient-to-r from-[#dbb878]/50 to-transparent" />
            </div>

            <BookingWidget cities={cities} tabFlags={tabFlags} />
        </div>
      </div>
    </>
  );
}
