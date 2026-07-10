import Link from "next/link";
import { useTranslations } from "next-intl";

const IMG = "/ourfleet.jpg";

export function FleetBanner() {
  const t = useTranslations("FleetShowcase");
  return (
    <section
      aria-label={t("browseOurFleet")}
      className="relative isolate overflow-hidden"
      style={{ height: "clamp(180px, 28vw, 320px)" }}
    >
      <style>{`
        @keyframes fleet-drift {
          0%   { transform: scale(1.12) translateX(-5%); }
          100% { transform: scale(1.12) translateX(5%); }
        }
      `}</style>

      {/*
        Single image scaled up 12% so edges never show during the pan.
        Pan range ±5% with alternate direction = seamless infinite drift.
        ease-in-out gives a soft, cinematic start/end to each swing.
        No copies, no seam, no cut — ever.
      */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={IMG}
        alt=""
        aria-hidden
        draggable={false}
        fetchPriority="high"
        className="pointer-events-none absolute inset-0 -z-10 h-full w-full object-cover"
        style={{
          animationName: "fleet-drift",
          animationDuration: "14s",
          animationTimingFunction: "ease-in-out",
          animationIterationCount: "infinite",
          animationDirection: "alternate",
          willChange: "transform",
        }}
      />

      {/* dark overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#003749]/90 via-[#003749]/50 to-[#003749]/30" aria-hidden />

      {/* خطان ذهبيان رفيعان أعلى وأسفل البانر */}
      <div className="absolute inset-x-0 top-0 z-10 h-px bg-gradient-to-r from-transparent via-[#dbb878]/70 to-transparent" aria-hidden />
      <div className="absolute inset-x-0 bottom-0 z-10 h-px bg-gradient-to-r from-transparent via-[#dbb878]/70 to-transparent" aria-hidden />

      {/* content */}
      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="flex items-center justify-center gap-3">
          <span className="h-px w-8 bg-gradient-to-l from-[#dbb878] to-transparent sm:w-12" aria-hidden />
          <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#dbb878]">
            {t("ourFleet")}
          </span>
          <span className="h-px w-8 bg-gradient-to-r from-[#dbb878] to-transparent sm:w-12" aria-hidden />
        </div>
        <h2 className="text-balance text-3xl font-black tracking-wide text-white drop-shadow-lg sm:text-4xl lg:text-5xl">
          {t("browseOurFleet")}
        </h2>
        <Link
          href="/fleet"
          className="mt-1 rounded-full bg-[#dbb878] px-8 py-3 text-sm font-extrabold text-[#1a1408] shadow-[0_12px_32px_-8px_rgba(219,184,120,0.55)] transition-all hover:-translate-y-0.5 hover:bg-[#e8c992] hover:shadow-[0_16px_40px_-8px_rgba(219,184,120,0.65)]"
        >
          {t("goToOurFleet")}
        </Link>
      </div>
    </section>
  );
}
