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
    <header className="relative flex flex-col overflow-x-hidden pt-24 md:pt-28">
      {/* ─── Hero image strip ─── */}
      <div
        className="grid w-full grid-cols-1 md:min-h-[min(45vh,22rem)] md:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)_minmax(0,1fr)]"
        dir="ltr"
      >
        {/* Left car image */}
        <div className="relative aspect-[5/3] w-full md:aspect-auto md:min-h-[min(52vh,28rem)]">
          <Image
            src={leftImageUrl}
            alt={leftImageAlt}
            fill
            priority
            className="object-cover"
            sizes="(min-width: 768px) 35vw, 100vw"
          />
          {/* bottom fade to white */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/60 to-transparent md:from-white/40" />
        </div>

        {/* Center headline */}
        <div
          dir="rtl"
          className="relative flex min-h-[12rem] flex-col items-center justify-center bg-white px-6 py-10 text-center md:min-h-0 md:py-8"
        >
          {/* Decorative gold line */}
          <div
            className="mb-5 h-1 w-16 rounded-full"
            style={{ background: "linear-gradient(90deg, #dbb878, #c9a356)" }}
          />
          <h1 className="text-balance text-2xl font-extrabold leading-snug tracking-tight text-[#0f3d47] md:text-3xl lg:text-4xl">
            روائس لتأجير السيارات
          </h1>
          <p className="mt-4 max-w-sm text-pretty text-sm font-medium leading-relaxed text-[#0f3d47]/75 md:text-base">
            مجموعة واسعة من السيارات لتلبية احتياجاتك بمختلف الفئات والميزانيات.
          </p>
          {/* Decorative gold line */}
          <div
            className="mt-5 h-1 w-16 rounded-full opacity-50"
            style={{ background: "linear-gradient(90deg, #dbb878, #c9a356)" }}
          />
        </div>

        {/* Right car image */}
        <div className="relative aspect-[5/3] w-full md:aspect-auto md:min-h-[min(52vh,28rem)]">
          <Image
            src={rightImageUrl}
            alt={rightImageAlt}
            fill
            priority
            className="object-cover"
            sizes="(min-width: 768px) 35vw, 100vw"
          />
          {/* bottom fade to white */}
          <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/60 to-transparent md:from-white/40" />
        </div>
      </div>

      {/* ─── Booking widget — floats above with pull-up on desktop ─── */}
      <div
        className="relative z-10 mx-auto w-full max-w-6xl px-4 pb-14 sm:px-6 lg:px-8 lg:pb-20"
        dir="rtl"
      >
        {/* Pull widget up to overlap images on md+ */}
        <div className="md:-mt-10 lg:-mt-14">
          {/* Label above widget */}
          <p className="mb-3 flex items-center gap-2 text-[12.5px] font-bold uppercase tracking-widest text-[#003749]/60">
            <span className="inline-block h-px w-8 bg-[#dbb878]" />
            احجز مركبتك الآن
            <span className="inline-block h-px w-8 bg-[#dbb878]" />
          </p>
          <BookingWidget branches={branches} />
        </div>
      </div>
    </header>
  );
}
