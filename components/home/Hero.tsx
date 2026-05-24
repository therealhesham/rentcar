import Image from "next/image";
import { Building2, Clock, ShieldCheck } from "lucide-react";
import {
  BookingWidget,
  type BookingCityBranchesOption,
} from "./BookingWidget";
import type { BookingWidgetTabFlags } from "@/lib/booking-widget-tabs";
import { HeroEntrance } from "./HomeMotion";

/** مؤقت: عطّل صور الهيرو الجانبية لرفع الـ widget أقرب للـ nav */
const SHOW_HERO_IMAGES = false;

const TRUST_ITEMS = [
  { icon: Building2, label: "فروع متعددة" },
  { icon: Clock, label: "حجز سريع أونلاين" },
  { icon: ShieldCheck, label: "خدمة موثوقة" },
] as const;

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
      className="relative flex max-w-2xl flex-col items-center justify-center text-center"
    >
      <div className="relative mb-3 flex items-center gap-2.5 sm:mb-4">
        <span className="h-px w-8 rounded-full bg-gradient-to-l from-[#dbb878] to-transparent sm:w-12" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[#dbb878] sm:text-[11px]">
          خدمة متميزة
        </span>
        <span className="h-px w-8 rounded-full bg-gradient-to-r from-[#dbb878] to-transparent sm:w-12" />
      </div>

      <h1 className="relative text-balance text-[1.65rem] font-extrabold leading-[1.15] tracking-tight text-[#0f3d47] sm:text-4xl md:text-[2.65rem] lg:text-[2.85rem]">
        روائس لتأجير السيارات
      </h1>

      <p className="relative mt-3 max-w-lg text-pretty text-sm font-medium leading-relaxed text-[#0f3d47]/60 sm:mt-4 sm:text-base md:max-w-xl">
        مجموعة واسعة من السيارات لتلبية احتياجاتك بمختلف الفئات والميزانيات — احجز أونلاين
        في دقائق.
      </p>

      <ul className="relative mt-5 flex flex-wrap items-center justify-center gap-2 sm:mt-6 sm:gap-2.5">
        {TRUST_ITEMS.map(({ icon: Icon, label }) => (
          <li
            key={label}
            className="inline-flex items-center gap-1.5 rounded-full border border-[#ebe4d3]/80 bg-white/80 px-3 py-1.5 text-[11px] font-bold text-[#003749] shadow-sm backdrop-blur-sm sm:px-3.5 sm:py-2 sm:text-xs"
          >
            <Icon className="size-3.5 shrink-0 text-[#dbb878]" aria-hidden />
            {label}
          </li>
        ))}
      </ul>

      <div className="relative mt-5 h-px w-12 rounded-full bg-gradient-to-r from-transparent via-[#dbb878]/45 to-transparent sm:mt-6" />
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
        <section className="relative flex flex-col overflow-x-hidden bg-gradient-to-b from-[#eef6f8] via-white to-[#fdfbf6] pt-[4.5rem] sm:pt-24">
          <HeroDecorations />
          <HeroEntrance className="relative z-[1] flex flex-col items-center px-4 pb-2 sm:px-6 sm:pb-4">
            {headlineBlock}
          </HeroEntrance>
        </section>
      )}

      <div
        id="home-booking"
        className={
          SHOW_HERO_IMAGES
            ? "relative z-30 -mt-8 scroll-mt-24 px-3 sm:-mt-12 sm:px-6 md:-mt-12 lg:-mt-16 lg:px-8"
            : "relative z-30 -mt-1 scroll-mt-24 px-3 pb-6 sm:-mt-2 sm:px-6 sm:pb-8 lg:px-8"
        }
        dir="rtl"
      >
        <div className="mx-auto w-full max-w-[72rem]">
          <div className="rounded-2xl border border-[#ebe4d3]/70 bg-white/95 p-3 shadow-[0_20px_60px_-16px_rgba(15,61,71,0.14)] backdrop-blur-md sm:rounded-[1.35rem] sm:p-4 lg:p-5">
            <div className="mb-2.5 flex items-center justify-center gap-2 sm:mb-3 sm:gap-3">
              <span className="hidden h-px w-10 bg-gradient-to-l from-[#dbb878]/50 to-transparent sm:block sm:w-12" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#003749]/45 sm:text-[11px] sm:tracking-[0.25em]">
                احجز مركبتك الآن
              </span>
              <span className="hidden h-px w-10 bg-gradient-to-r from-[#dbb878]/50 to-transparent sm:block sm:w-12" />
            </div>

            <BookingWidget cities={cities} tabFlags={tabFlags} />
          </div>
        </div>
      </div>
    </>
  );
}

function HeroDecorations() {
  return (
    <>
      <div
        className="pointer-events-none absolute -start-40 top-8 h-80 w-80 rounded-full bg-[#dbb878]/12 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -end-40 top-24 h-72 w-72 rounded-full bg-[#003749]/6 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: "radial-gradient(circle, #003749 1px, transparent 1px)",
          backgroundSize: "22px 22px",
        }}
        aria-hidden
      />
    </>
  );
}
