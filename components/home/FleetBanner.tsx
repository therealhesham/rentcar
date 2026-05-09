import Link from "next/link";

const IMG = "/ourfleet.jpg";

export function FleetBanner() {
  return (
    <section
      aria-label="تصفح أسطولنا"
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
      <div className="absolute inset-0 " aria-hidden />

      {/* content */}
      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
        <h2 className="rounded-lg px-6 py-3 text-3xl font-black tracking-wide text-white drop-shadow-lg sm:text-4xl lg:text-5xl">
          تصفح اسطولنا
        </h2>
        <Link
          href="/fleet"
          className="rounded-full border border-white/70 bg-white/10 px-6 py-2 text-sm font-bold text-white backdrop-blur-sm transition-colors hover:bg-white hover:text-[#003749]"
        >
          انتقل إلى أسطولنا
        </Link>
      </div>
    </section>
  );
}
