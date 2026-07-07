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
  return (
    <>
      {SHOW_HERO_IMAGES ? (
        <header className="relative flex flex-col overflow-x-hidden bg-white pt-24 md:pt-28">
          <HeroEntrance className="w-full">
            <div
              className="relative grid w-full grid-cols-1 md:min-h-[min(45vh,22rem)] md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]"
              dir="ltr"
            >
              <div className="relative aspect-[5/3] w-full overflow-hidden md:aspect-auto md:min-h-[min(52vh,28rem)]">
                <Image
                  src={leftImageUrl}
                  alt={leftImageAlt}
                  fill
                  priority
                  className="object-cover"
                  sizes="(min-width: 768px) 50vw, 100vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0f3d47]/30 via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white via-white/70 to-transparent" />
              </div>

              <div className="relative aspect-[5/3] w-full overflow-hidden md:aspect-auto md:min-h-[min(52vh,28rem)]">
                <Image
                  src={rightImageUrl}
                  alt={rightImageAlt}
                  fill
                  priority
                  className="object-cover"
                  sizes="(min-width: 768px) 50vw, 100vw"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#0f3d47]/30 via-transparent to-transparent" />
                <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white via-white/70 to-transparent" />
              </div>
            </div>
          </HeroEntrance>
        </header>
      ) : (
        <section
          className="relative flex flex-col overflow-x-hidden bg-gradient-to-b from-[#eef6f8] via-white to-[#fdfbf6] pt-[4.5rem] sm:pt-24"
          aria-hidden
        >
          <HeroDecorations />
        </section>
      )}

      <div
        id="home-booking"
        className={
          SHOW_HERO_IMAGES
            ? "-mt-8 scroll-mt-24 px-3 sm:-mt-12 sm:px-6 md:-mt-12 lg:-mt-16 lg:px-8"
            : "-mt-1 scroll-mt-24 px-3 pb-6 sm:-mt-2 sm:px-6 sm:pb-8 lg:px-8"
        }
        dir="rtl"
      >
        <div className="mx-auto w-full max-w-[72rem]">
          <BookingWidget cities={cities} tabFlags={tabFlags} />
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
