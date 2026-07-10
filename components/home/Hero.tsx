import Image from "next/image";
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

export function Hero({ cities, tabFlags }: HeroProps) {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#eef6f8] via-white to-[#fdfbf6] pt-[4.5rem] sm:pt-24">
      {/* صورة واقعية للمسجد النبوي — مع طبقة تفتيح لوضوح المحتوى */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <Image
          src="/mol2-2-1.avif"
          alt=""
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-white/45" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/70 to-transparent" />
      </div>

      <div
        id="home-booking"
        className="relative z-10 scroll-mt-24 px-3 pt-64 sm:px-6 sm:pt-[26rem] lg:px-8 lg:pt-[30rem]"
        dir="rtl"
      >
        <div className="mx-auto w-full max-w-[72rem]">
          <HeroEntrance>
            <BookingWidget cities={cities} tabFlags={tabFlags} />
          </HeroEntrance>
        </div>
      </div>

      {/* مساحة تُظهر الرسمة أسفل كارت البحث */}
      <div className="h-24 sm:h-28 lg:h-32" aria-hidden />

      {/* شريط ذهبي أسفل الهيرو */}
      <div className="relative h-1.5 w-full bg-[#dbb878]" aria-hidden />
    </section>
  );
}
