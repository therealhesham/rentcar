import Image from "next/image";
import Link from "next/link";
import { getFleetCategoriesForHome } from "@/lib/fleet-category-data";

export async function FleetCategories() {
  const categories = await getFleetCategoriesForHome().catch(() => []);

  if (categories.length === 0) {
    return null;
  }

  return (
    <section
      id="fleet-categories"
      className="relative overflow-hidden bg-[#fdfbf6] py-20 text-on-surface sm:py-28"
      dir="rtl"
      aria-labelledby="fleet-categories-heading"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.035]"
        style={{
          backgroundImage:
            "radial-gradient(circle, #003749 1.25px, transparent 1.25px)",
          backgroundSize: "22px 22px",
        }}
      />
      <div className="pointer-events-none absolute -start-[18rem] top-0 h-[36rem] w-[36rem] rounded-full bg-gradient-to-tr from-[#dbb878]/12 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute -end-[18rem] bottom-0 h-[36rem] w-[36rem] rounded-full bg-gradient-to-bl from-[#003749]/8 to-transparent blur-3xl" />

      <div className="relative mx-auto max-w-screen-xl px-4 sm:px-8">
        <header className="mb-14 flex flex-col items-center text-center sm:mb-16">
          <div className="mb-4 flex items-center justify-center gap-3">
            <span className="h-[1.5px] w-10 rounded-full bg-gradient-to-l from-[#dbb878] to-transparent sm:w-12" />
            <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#775927] sm:text-[12px]">
              الأسطول
            </span>
            <span className="h-[1.5px] w-10 rounded-full bg-gradient-to-r from-[#dbb878] to-transparent sm:w-12" />
          </div>
          <h2
            id="fleet-categories-heading"
            className="text-3xl font-extrabold tracking-tight text-[#003749] sm:text-4xl lg:text-[2.75rem]"
          >
            فئات أسطولنا
          </h2>
          <p className="mt-4 max-w-2xl text-pretty text-base font-medium leading-relaxed text-[#003749]/72 sm:text-lg">
            اختر الفئة التي تناسب مناسبتك واكتشف المركبات المتاحة للتأجير اليومي مع أسعار شفافة
            وتجربة حجز سلسة.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 lg:gap-8">
          {categories.map((cat) => {
            const n = cat._count.models;
            const countLabel =
              n === 0 ? null : n === 1 ? "موديل واحد" : `${n} موديلات`;

            return (
              <article
                key={cat.id}
                className="group relative flex h-full flex-col overflow-hidden rounded-[1.75rem] border border-[#ebe4d3]/65 bg-white/85 shadow-[0_8px_28px_-14px_rgba(15,61,71,0.12)] backdrop-blur-md transition-all duration-300 hover:-translate-y-1 hover:border-[#dbb878]/42 hover:bg-white hover:shadow-[0_22px_44px_-14px_rgba(219,184,120,0.22)]"
              >
                <div className="pointer-events-none absolute inset-x-0 top-0 h-[3px] origin-right scale-x-0 bg-gradient-to-l from-[#dbb878] via-[#e8c994] to-[#c9a356] transition-transform duration-500 ease-out group-hover:scale-x-100" />

                <div className="flex flex-1 flex-col p-6 sm:p-7 lg:p-8">
                  <div className="mb-4 flex min-h-[1.75rem] flex-wrap items-center justify-center gap-2">
                    {countLabel ? (
                      <span className="inline-flex rounded-full border border-[#dbb878]/35 bg-[#dbb878]/12 px-3 py-0.5 text-[11px] font-bold tabular-nums text-[#684c1b]">
                        {countLabel}
                      </span>
                    ) : (
                      <span className="inline-flex rounded-full border border-neutral-200/80 bg-neutral-50 px-3 py-0.5 text-[11px] font-bold text-on-surface-variant">
                        قريباً
                      </span>
                    )}
                  </div>

                  <h3 className="mb-4 text-center text-xl font-extrabold leading-snug text-[#003749] sm:text-[1.35rem]">
                    {cat.title}
                  </h3>

                  <div className="relative mb-5 aspect-[2/1] min-h-[160px] w-full overflow-hidden rounded-2xl bg-gradient-to-b from-[#fcf9f5] via-white to-[#f8f5ef] ring-1 ring-[#ebe4d3]/90 sm:min-h-[190px] lg:aspect-[16/10] lg:min-h-[170px]">
                    <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(219,184,120,0.07)_0%,_transparent_65%)]" />
                    <Image
                      src={cat.image}
                      alt={cat.alt?.trim() || cat.title}
                      fill
                      className="object-contain object-center px-3 py-2 transition-transform duration-500 ease-out group-hover:scale-[1.045] sm:px-5 sm:py-4"
                      sizes="(min-width: 1024px) 31vw, (min-width: 640px) 46vw, 92vw"
                    />
                  </div>

                  <p className="mb-6 flex-1 text-center text-sm leading-7 text-on-surface-variant">
                    {cat.description}
                  </p>

                  <Link
                    href={`/fleet?category=${encodeURIComponent(cat.slug)}`}
                    className="mt-auto inline-flex items-center justify-center gap-2 rounded-xl bg-[#003749] px-4 py-3.5 text-sm font-extrabold text-white shadow-[0_10px_28px_-12px_rgba(0,55,73,0.45)] transition-[transform,box-shadow,opacity] hover:opacity-[0.96] hover:shadow-[0_14px_36px_-12px_rgba(0,55,73,0.5)] active:scale-[0.99]"
                  >
                    <span>اكتشف الفئة</span>
                    <svg
                      viewBox="0 0 24 24"
                      fill="none"
                      className="size-4 shrink-0 opacity-90"
                      aria-hidden
                    >
                      <path
                        d="M15 18l-6-6 6-6"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </Link>
                </div>
              </article>
            );
          })}
        </div>

        <div className="mt-14 flex justify-center sm:mt-16">
          <Link
            href="/fleet"
            className="inline-flex items-center gap-2 rounded-full border-2 border-[#003749]/20 bg-white/90 px-8 py-3 text-sm font-extrabold text-[#003749] shadow-sm backdrop-blur-sm transition-colors hover:border-[#dbb878]/50 hover:bg-[#fdfbf6]"
          >
            عرض كامل الأسطول
            <svg viewBox="0 0 24 24" fill="none" className="size-4" aria-hidden>
              <path
                d="M15 18l-6-6 6-6"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Link>
        </div>
      </div>
    </section>
  );
}
