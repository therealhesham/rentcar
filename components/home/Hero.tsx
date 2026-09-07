import { useLocale } from "next-intl";
import {
  BookingWidget,
  type BookingCityBranchesOption,
} from "./BookingWidget";
import type { BookingWidgetTabFlags } from "@/lib/booking-widget-tabs";
import type { HomeHeroColors } from "@/lib/home-hero-colors";
import type { HomeHeroSlide } from "@/lib/site-settings";
import { HeroEntrance } from "./HomeMotion";
import { HeroSlideshow } from "./HeroSlideshow";

export type HeroProps = {
  /** صور الخلفية — أكثر من واحدة تتنقّل تلقائياً */
  slides: HomeHeroSlide[];
  /** ألوان النصوص التي يضبطها المسؤول */
  colors?: HomeHeroColors;
  cities: BookingCityBranchesOption[];
  tabFlags?: BookingWidgetTabFlags | null;
  /** تبويب الإيجار من `?rental=` — حتى يطابق الويدجت أسعار البطاقات بعد إعادة التحميل */
  initialRental?: string | null;
};

export function Hero({
  slides,
  cities,
  tabFlags,
  initialRental,
}: HeroProps) {
  const locale = useLocale();
  const isRtl = locale === "ar";

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#eef6f8] via-white to-[#fdfbf6] pt-[4.5rem] sm:pt-24">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <HeroSlideshow slides={slides} isRtl={isRtl} />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/70 to-transparent" />
      </div>

      {/* عنوان الهيرو (تم إخفاؤه حسب الطلب) */}

      <div
        id="home-booking"
        className="relative z-10 scroll-mt-24 px-3 pt-52 pb-12 sm:px-6 sm:pt-[22rem] sm:pb-16 lg:px-8 lg:pt-[26rem]"
        dir="rtl"
      >
        <div className="mx-auto w-full max-w-[84rem]">
          <HeroEntrance delay={0.12}>
            <BookingWidget
              cities={cities}
              tabFlags={tabFlags}
              initialFromUrl={initialRental ? { rental: initialRental } : null}
            />
          </HeroEntrance>
        </div>
      </div>

      {/* مؤشرات الثقة أسفل كارت البحث (تم إخفاؤها حسب الطلب) */}

      {/* خط ذهبي رفيع أسفل الهيرو */}
      <div
        className="relative h-[3px] w-full bg-gradient-to-r from-transparent via-[#dbb878] to-transparent"
        aria-hidden
      />
    </section>
  );
}
