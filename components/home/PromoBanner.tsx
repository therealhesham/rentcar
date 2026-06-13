import { getPromoBannerSlides } from "@/lib/site-settings";
import { Reveal } from "./HomeMotion";
import { PromoBannerCarousel } from "./PromoBannerCarousel";
import { getLocale, getTranslations } from "next-intl/server";

export async function PromoBanner() {
  const slides = await getPromoBannerSlides();
  if (slides.length === 0) return null;

  const locale = await getLocale();
  const t = await getTranslations("PromoBanner");

  return (
    <section aria-label={t("ariaLabel")} className="bg-[#fafafa] px-4 py-10 sm:px-6 sm:py-14 lg:px-8" dir={locale === 'ar' ? 'rtl' : 'ltr'}>
      <Reveal>
        <div className="mx-auto max-w-screen-xl">
          <header className="mb-6 flex flex-col items-center text-center sm:mb-8">
            <div className="mb-3 flex items-center gap-3">
              <span className="h-px w-10 bg-gradient-to-l from-[#dbb878] to-transparent" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#dbb878]">
                {t("exclusiveOffers")}
              </span>
              <span className="h-px w-10 bg-gradient-to-r from-[#dbb878] to-transparent" />
            </div>
            <h2 className="text-xl font-extrabold text-[#003749] sm:text-2xl">{t("dontMissOut")}</h2>
          </header>

          <div className="overflow-hidden rounded-2xl border border-[#ebe4d3]/70 bg-white p-3 shadow-[0_12px_40px_-16px_rgba(15,61,71,0.1)] sm:rounded-[1.35rem] sm:p-4">
            <PromoBannerCarousel slides={slides} />
          </div>
        </div>
      </Reveal>
    </section>
  );
}
