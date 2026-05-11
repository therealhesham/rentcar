import Image from "next/image";
import { BookingWidget, type BookingBranchOption } from "./BookingWidget";

export type HeroProps = {
  leftImageUrl: string;
  leftImageAlt: string;
  rightImageUrl: string;
  rightImageAlt: string;
  branches: BookingBranchOption[];
};

export function Hero({
  leftImageUrl,
  leftImageAlt,
  rightImageUrl,
  rightImageAlt,
  branches,
}: HeroProps) {
  return (
    <>
      <header className="relative flex flex-col overflow-x-hidden bg-white pt-24 md:pt-28">
        {/* ─── Hero image strip ─── */}
        <div
          className="relative grid w-full grid-cols-1 md:min-h-[min(45vh,22rem)] md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)]"
          dir="ltr"
        >
          {/* Left image */}
          <div className="relative aspect-[5/3] w-full overflow-hidden md:aspect-auto md:min-h-[min(52vh,28rem)]">
            <Image
              src={leftImageUrl}
              alt={leftImageAlt}
              fill
              priority
              className="object-cover"
              sizes="(min-width: 768px) 35vw, 100vw"
            />
            {/* Dark overlay for depth */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f3d47]/30 via-transparent to-transparent" />
            {/* Bottom fade to white */}
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white via-white/70 to-transparent" />
          </div>

          {/* Center headline */}
          <div
            dir="rtl"
            className="relative flex min-h-[14rem] flex-col items-center justify-center px-6 py-10 text-center md:min-h-0 md:py-8"
          >
            {/* Subtle pattern background */}
            <div className="absolute inset-0 opacity-[0.03]"
              style={{
                backgroundImage: "radial-gradient(circle, #003749 1px, transparent 1px)",
                backgroundSize: "20px 20px",
              }}
            />
            
            {/* Gold accent bar */}
            <div className="relative mb-6 flex items-center gap-3">
              <span className="h-[1.5px] w-10 rounded-full bg-gradient-to-l from-[#dbb878] to-transparent" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#dbb878]">
                خدمة متميزة
              </span>
              <span className="h-[1.5px] w-10 rounded-full bg-gradient-to-r from-[#dbb878] to-transparent" />
            </div>

            <h1 className="relative text-balance text-2xl font-extrabold leading-snug tracking-tight text-[#0f3d47] md:text-3xl lg:text-[2.5rem]">
              روائس لتأجير السيارات
            </h1>

            <p className="relative mt-4 max-w-sm text-pretty text-sm font-medium leading-relaxed text-[#0f3d47]/65 md:text-[15px]">
              مجموعة واسعة من السيارات لتلبية احتياجاتك بمختلف الفئات والميزانيات.
            </p>

            {/* Bottom accent */}
            <div className="relative mt-6 h-[1.5px] w-12 rounded-full bg-gradient-to-r from-transparent via-[#dbb878]/50 to-transparent" />
          </div>

          {/* Right image */}
          <div className="relative aspect-[5/3] w-full overflow-hidden md:aspect-auto md:min-h-[min(52vh,28rem)]">
            <Image
              src={rightImageUrl}
              alt={rightImageAlt}
              fill
              priority
              className="object-cover"
              sizes="(min-width: 768px) 35vw, 100vw"
            />
            {/* Dark overlay for depth */}
            <div className="absolute inset-0 bg-gradient-to-t from-[#0f3d47]/30 via-transparent to-transparent" />
            {/* Bottom fade to white */}
            <div className="absolute inset-x-0 bottom-0 h-32 bg-gradient-to-t from-white via-white/70 to-transparent" />
          </div>
        </div>
      </header>

      {/* ─── Booking widget: يبقى تحت الهيدر عند التمرير ─── */}
      <div
        className="sticky top-16 z-40 -mt-8 border-b border-[#ebe4d3]/70 bg-white/92 shadow-[0_8px_28px_-6px_rgba(15,61,71,0.1)] backdrop-blur-md sm:top-24 sm:-mt-12 md:-mt-12 lg:-mt-16"
        dir="rtl"
      >
        <div className="mx-auto w-full max-w-[72rem] px-4 pb-4 pt-3 sm:px-6 sm:pb-5 sm:pt-4 lg:px-8 lg:pb-6">
          <div className="mb-3 flex items-center justify-center gap-3 sm:mb-4">
            <span className="h-px w-12 bg-gradient-to-l from-[#dbb878]/50 to-transparent" />
            <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-[#003749]/40">
              احجز مركبتك الآن
            </span>
            <span className="h-px w-12 bg-gradient-to-r from-[#dbb878]/50 to-transparent" />
          </div>

          <BookingWidget branches={branches} />
        </div>
      </div>
    </>
  );
}
