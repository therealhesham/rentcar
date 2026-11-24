import { Clock, MapPin, Phone, ShieldCheck, Zap } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import {
  BookingWidget,
  type BookingCityBranchesOption,
} from "./BookingWidget";
import type { BookingWidgetTabFlags } from "@/lib/booking-widget-tabs";
import { DEFAULT_HOME_HERO_COLORS, type HomeHeroColors } from "@/lib/home-hero-colors";
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
  /** الرقم المجاني الموحّد — يُعرض كزر اتصال أنيق تحت العنوان إن وُجد */
  tollFreePhone?: string | null;
};

export function Hero({
  slides,
  colors = DEFAULT_HOME_HERO_COLORS,
  cities,
  tabFlags,
  initialRental,
  tollFreePhone,
}: HeroProps) {
  const t = useTranslations("Hero");
  const locale = useLocale();
  const isRtl = locale === "ar";
  const tollFree = tollFreePhone?.trim() || "";
  const tollFreeHref = `tel:${tollFree.replace(/[^\d+]/g, "")}`;

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#eef6f8] via-white to-[#fdfbf6] pt-[4.5rem] sm:pt-24">
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
        <HeroSlideshow slides={slides} isRtl={isRtl} />
        <div className="absolute inset-x-0 bottom-0 h-24 bg-gradient-to-t from-white/70 to-transparent" />
      </div>

      {/* عنوان الهيرو */}
      <div
        className="relative z-10 px-4 pt-6 text-center sm:pt-10"
        dir={isRtl ? "rtl" : "ltr"}
      >
        <HeroEntrance>
          <div className="mb-4 flex items-center justify-center gap-3">
            <span
              className="h-px w-10 sm:w-16"
              style={{
                backgroundImage: `linear-gradient(to left, ${colors.eyebrowLineColor}, transparent)`,
              }}
            />
            <span
              className="text-xs sm:text-[13.5px] font-black uppercase tracking-[0.24em]"
              style={{ color: colors.eyebrowTextColor }}
            >
              {t("description")}
            </span>
            <span
              className="h-px w-10 sm:w-16"
              style={{
                backgroundImage: `linear-gradient(to right, ${colors.eyebrowLineColor}, transparent)`,
              }}
            />
          </div>
          <h1
            className="text-balance text-3xl font-black tracking-tight [text-shadow:0_1px_28px_rgba(255,255,255,0.9)] sm:text-5xl lg:text-6xl"
            style={{ color: colors.titleColor }}
          >
            {t("title")}
          </h1>
          {/* `CC` = شفافية ٨٠٪، نفس `/80` في التصميم الأصلي */}
          <p
            className="mx-auto mt-3 max-w-xl text-pretty text-sm font-semibold leading-relaxed [text-shadow:0_1px_18px_rgba(255,255,255,0.9)] sm:mt-4 sm:text-lg"
            style={{ color: `${colors.subtitleColor}CC` }}
          >
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
            <BookingWidget
              cities={cities}
              tabFlags={tabFlags}
              initialFromUrl={initialRental ? { rental: initialRental } : null}
            />
          </HeroEntrance>
        </div>
      </div>

      {/* مؤشرات الثقة أسفل كارت البحث */}
      <div
        className="relative z-10 flex flex-wrap items-center justify-center gap-2.5 px-3 pb-10 pt-8 sm:gap-4 sm:px-6 sm:pb-14 sm:pt-10 lg:px-8"
        dir={isRtl ? "rtl" : "ltr"}
      >
        {/* الرقم المجاني — أسفل كارت البحث على الشمال (لتبديله لليمين: غيّر justify-start إلى justify-end) */}
        {tollFree ? (
          <div className="mx-auto -mt-2 flex w-full max-w-[84rem] justify-start" dir="ltr">
            <HeroEntrance delay={0.24}>
              <a
                href={tollFreeHref}
                aria-label={`${t("tollFreeLabel")} ${tollFree}`}
                // ألوان ثابتة (تيل غامق + ذهبي) لا تتبع ألوان العنوان — حتى يظهر واضحاً
                // على أي صورة خلفية يختارها المسؤول، فاتحة كانت أو داكنة.
                className="group inline-flex items-center gap-3 rounded-full border border-[#dbb878]/50 bg-[#0f3d47]/90 py-1.5 ps-1.5 pe-5 shadow-[0_10px_30px_-10px_rgba(15,61,71,0.6)] backdrop-blur-md transition duration-300 hover:-translate-y-0.5 hover:border-[#dbb878] hover:bg-[#0f3d47] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#dbb878]"
              >
                <span className="relative grid size-9 shrink-0 place-items-center rounded-full bg-[#dbb878] text-[#0f3d47] sm:size-10">
                  <span
                    className="absolute inset-0 rounded-full bg-[#dbb878] opacity-40 motion-safe:animate-ping"
                    aria-hidden
                  />
                  <Phone className="relative size-4 sm:size-[18px]" aria-hidden />
                </span>
                <span
                  className="flex flex-col items-start leading-tight"
                  dir={isRtl ? "rtl" : "ltr"}
                >
                  <span className="text-[11px] font-bold text-white/70 sm:text-xs">
                    {t("tollFreeLabel")}
                  </span>
                  <span
                    dir="ltr"
                    className="text-base font-black tracking-wider text-white tabular-nums sm:text-lg"
                  >
                    {tollFree}
                  </span>
                </span>
              </a>
            </HeroEntrance>
          </div>
        ) : null}
        {/* <HeroEntrance delay={0.24}>
          <ul className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-4">
            {[
              { icon: Clock, label: t("trustSupport") },
              { icon: MapPin, label: t("trustBranches") },
              { icon: ShieldCheck, label: t("trustPricing") },
              { icon: Zap, label: t("trustBooking") },
            ].map(({ icon: Icon, label }) => (
              <li
                key={label}
                className="flex items-center gap-2 rounded-full border border-white/60 bg-white/70 px-4 py-2 text-[12.5px] font-bold shadow-[0_4px_16px_-6px_rgba(15,61,71,0.15)] backdrop-blur-md sm:text-sm"
                style={{ color: colors.trustTextColor }}
              >
                <Icon
                  className="size-4 shrink-0"
                  style={{ color: colors.trustIconColor }}
                  aria-hidden
                />
                {label}
              </li>
            ))}
          </ul>
        </HeroEntrance> */}
      </div>

      {/* خط ذهبي رفيع أسفل الهيرو */}
      <div
        className="relative h-[3px] w-full bg-gradient-to-r from-transparent via-[#dbb878] to-transparent"
        aria-hidden
      />
    </section>
  );
}
