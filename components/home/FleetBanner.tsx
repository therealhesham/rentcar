import Link from "next/link";

const IMG = "/ourfleet.jpg";
const COPIES = 6;

export function FleetBanner() {
  return (
    <section
      aria-label="تصفح أسطولنا"
      className="relative isolate overflow-hidden"
      style={{ height: "clamp(180px, 28vw, 320px)" }}
    >
      {/* keyframe مدمج مباشرةً — يعمل في Server Components بدون مشكلة */}
      <style>{`
        @keyframes fleet-pan {
          from { transform: translateX(0); }
          to   { transform: translateX(-50%); }
        }
      `}</style>

      {/*
        شريط = 6 نسخ متلاصقة من الصورة.
        كل نسخة بعرض صريح = عرض الشاشة (100vw).
        الشريط يتحرك من 0 إلى -50% من عرضه الكلي (= 3 نسخ = 300vw).
        عند الـ reset ترى النسخة 4 مكان النسخة 1 — مطابقة تامة → loop سلس.
        لا يوجد dir="ltr" لأن translateX سلبي يتحرك نحو اليسار بغض النظر عن RTL.
      */}
      <div
        aria-hidden
        className="pointer-events-none absolute top-0 left-0 -z-10 flex h-full flex-row"
        style={{
          width: `${COPIES * 100}vw`,
          animationName: "fleet-pan",
          animationDuration: "28s",
          animationTimingFunction: "linear",
          animationIterationCount: "infinite",
          willChange: "transform",
        }}
      >
        {Array.from({ length: COPIES }).map((_, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={i}
            src={IMG}
            alt=""
            draggable={false}
            className="block h-full flex-none object-cover"
            style={{ width: "100vw", minWidth: "100vw", maxWidth: "100vw" }}
            fetchPriority={i === 0 ? "high" : "low"}
          />
        ))}
      </div>

      {/* طبقة تعتيم */}
      <div className="absolute inset-0" aria-hidden />

      {/* المحتوى */}
      <div className="relative z-10 flex h-full flex-col items-center justify-center gap-4 px-4 text-center">
        <h2 className="rounded-lg  px-6 py-3 text-3xl font-black tracking-wide text-white drop-shadow-lg sm:text-4xl lg:text-5xl">
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
