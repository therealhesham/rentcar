import {
  BookingWidget,
  type BookingCityBranchesOption,
} from "./BookingWidget";
import type { BookingWidgetTabFlags } from "@/lib/booking-widget-tabs";
import { HeroEntrance } from "./HomeMotion";

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
  cities,
  tabFlags,
}: HeroProps) {
  // Use the left hero image as the full-bleed background
  const bgUrl = leftImageUrl;

  return (
    <>
      {/* Full-bleed hero background section */}
      <section
        className="relative flex min-h-[520px] flex-col items-center justify-end overflow-hidden pb-0 pt-[4.5rem] sm:min-h-[600px] sm:pt-24"
        aria-label="Hero"
      >
        {/* Background image */}
        {bgUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={bgUrl}
            alt={leftImageAlt}
            aria-hidden
            draggable={false}
            fetchPriority="high"
            className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover opacity-40"
          />
        ) : (
          <HeroDecorations />
        )}

        {/* Gradient overlays — top fade + bottom fade for seamless blend */}
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          aria-hidden
          style={{
            background:
              "linear-gradient(to bottom, #fcf9f8 0%, transparent 28%, transparent 62%, #fcf9f8 100%)",
          }}
        />

        {/* Subtle radial glow decorations */}
        <div
          className="pointer-events-none absolute -start-40 top-8 h-80 w-80 rounded-full bg-[#dbb878]/10 blur-3xl"
          aria-hidden
        />
        <div
          className="pointer-events-none absolute -end-40 top-24 h-72 w-72 rounded-full bg-[#003749]/6 blur-3xl"
          aria-hidden
        />
      </section>

      {/* Booking widget — overlaps the bottom of the hero */}
      <HeroEntrance>
        <div
          id="home-booking"
          className="-mt-1 scroll-mt-24 px-3 pb-6 sm:-mt-2 sm:px-6 sm:pb-8 lg:px-8"
          dir="rtl"
        >
          <div className="mx-auto w-full max-w-[72rem]">
            <BookingWidget cities={cities} tabFlags={tabFlags} />
          </div>
        </div>
      </HeroEntrance>
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
