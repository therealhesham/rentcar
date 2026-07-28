import Image from "next/image";
import { Clock, MapPin, ShieldCheck, Zap } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
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
  const t = useTranslations("Hero");
  const locale = useLocale();
  const isRtl = locale === "ar";

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#eef6f8] via-white to-[#fdfbf6] pt-[4.5rem] sm:pt-24">
      {/* صورة واقعية للمسجد النبوي — مع طبقة تفتيح لوضوح المحتوى */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <Image
          src="/ssss.jpeg"
          alt=""
          fill
          priority
          className="object-cover object-center"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-white/45" />
        <div className="absolute inset-x-0 top-0 h-48 bg-gradient-to-b from-white/80 via-white/40 to-transparent sm:h-64" />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/70 to-transparent" />
      </div>

      {/* عنوان الهيرو */}
      <div
        className="relative z-10 px-4 pt-6 text-center sm:pt-10"
        dir={isRtl ? "rtl" : "ltr"}
      >
        <HeroEntrance>
          <div className="mb-4 flex items-center justify-center gap-3">
            <span className="h-px w-10 bg-gradient-to-l from-[#c9a356] to-transparent sm:w-16" />
            <span className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#a8874f]">
              {t("description")}
            </span>
            <span className="h-px w-10 bg-gradient-to-r from-[#c9a356] to-transparent sm:w-16" />
          </div>
          <h1 className="text-balance text-3xl font-black tracking-tight text-[#003749] [text-shadow:0_1px_28px_rgba(255,255,255,0.9)] sm:text-5xl lg:text-6xl">
            {t("title")}
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-pretty text-sm font-semibold leading-relaxed text-[#0f3d47]/80 [text-shadow:0_1px_18px_rgba(255,255,255,0.9)] sm:mt-4 sm:text-lg">
            {t("subtitle")}
          </p>
        </HeroEntrance>
      </div>

      <div
        id="home-booking"
        className="relative z-10 scroll-mt-24 px-3 pt-36 sm:px-6 sm:pt-[16rem] lg:px-8 lg:pt-[19rem]"
        dir="rtl"
      >
        <div className="mx-auto w-full max-w-[84rem]">
          <HeroEntrance delay={0.12}>
            <BookingWidget cities={cities} tabFlags={tabFlags} />
          </HeroEntrance>
        </div>
      </div>

      {/* مؤشرات الثقة أسفل كارت البحث */}
      <div
        className="relative z-10 flex flex-wrap items-center justify-center gap-2.5 px-4 pb-10 pt-8 sm:gap-4 sm:pb-14 sm:pt-10"
        dir={isRtl ? "rtl" : "ltr"}
      >
        <HeroEntrance delay={0.24}>
          <ul className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-4">
            {[
              { icon: Clock, label: t("trustSupport") },
              { icon: MapPin, label: t("trustBranches") },
              { icon: ShieldCheck, label: t("trustPricing") },
              { icon: Zap, label: t("trustBooking") },
            ].map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-4 py-2 text-[12.5px] font-bold text-[#0f3d47] shadow-[0_4px_16px_-6px_rgba(15,61,71,0.15)] backdrop-blur-md sm:text-sm"
              >
                <Icon className="size-4 shrink-0 text-[#c9a356]" aria-hidden />
                {label}
              </li>
            ))}
          </ul>
        </HeroEntrance>
      </div>

      {/* خط ذهبي رفيع أسفل الهيرو */}
      <div
        className="relative h-[3px] w-full bg-gradient-to-r from-transparent via-[#dbb878] to-transparent"
        aria-hidden
      />
    </section>
  );
}
