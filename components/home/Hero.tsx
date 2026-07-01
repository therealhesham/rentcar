import { useTranslations } from "next-intl";
import { HeroEntrance } from "./HomeMotion";

export type HeroProps = {
  leftImageUrl: string;
  leftImageAlt: string;
  rightImageUrl: string;
  rightImageAlt: string;
};

export function Hero({ leftImageUrl, leftImageAlt }: HeroProps) {
  // Use the left hero image as the full-bleed background
  const bgUrl = leftImageUrl;
  const heroT = useTranslations("Hero");
  const homeT = useTranslations("HomePage");

  return (
    <section
      className="relative flex flex-col items-center overflow-hidden pb-6 pt-2 sm:min-h-[640px] sm:justify-end sm:pb-0 sm:pt-24"
      aria-label="Hero"
    >
      {/* Background image — a compact banner on mobile (full image, no crop), then
          a full-bleed absolute background from sm upward, starting below the fixed navbar */}
      {bgUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={bgUrl}
          alt={leftImageAlt}
          aria-hidden
          draggable={false}
          fetchPriority="high"
          className="pointer-events-none relative z-0 mt-3 aspect-[16/9] w-[calc(100%-2rem)] max-w-sm rounded-2xl object-cover shadow-[0_12px_28px_-14px_rgba(0,55,73,0.35)] sm:absolute sm:inset-x-0 sm:bottom-0 sm:top-24 sm:-z-10 sm:mt-0 sm:aspect-auto sm:h-[calc(100%-6rem)] sm:w-full sm:max-w-none sm:rounded-none sm:object-cover sm:opacity-40 sm:shadow-none"
        />
      ) : (
        <HeroDecorations />
      )}

      {/* Subtle radial glow decorations */}
      <div
        className="pointer-events-none absolute -start-40 top-24 h-80 w-80 rounded-full bg-[#dbb878]/10 blur-3xl sm:top-32"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -end-40 top-40 h-72 w-72 rounded-full bg-[#003749]/6 blur-3xl sm:top-48"
        aria-hidden
      />

      {/* Headline — sits above the booking widget, within the image area */}
      <HeroEntrance className="relative z-[1] flex w-full flex-col items-center px-4 pb-6 pt-5 text-center sm:pb-10 sm:pt-0">
        <div className="flex flex-col items-center gap-4 rounded-[1.75rem] bg-white/55 px-6 py-6 shadow-[0_24px_60px_-28px_rgba(0,55,73,0.3)] ring-1 ring-white/60 backdrop-blur-md sm:gap-5 sm:rounded-[2.25rem] sm:px-12 sm:py-9">
          <h1 className="max-w-2xl text-balance text-[1.85rem] font-black leading-[1.15] tracking-tight text-[#003749] sm:text-[2.75rem] lg:max-w-3xl lg:text-[3.25rem]">
            {homeT("title")}
          </h1>

          <span
            className="h-[3px] w-16 rounded-full bg-gradient-to-r from-transparent via-[#dbb878] to-transparent"
            aria-hidden
          />

          <p className="max-w-xl text-pretty text-sm font-medium leading-relaxed text-[#003749]/75 sm:text-base lg:text-lg">
            {heroT("subtitle")}
          </p>
        </div>
      </HeroEntrance>
    </section>
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
