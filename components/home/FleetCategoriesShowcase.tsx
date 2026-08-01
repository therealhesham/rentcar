"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { FleetCarCard } from "@/components/fleet/FleetCarCard";
import type { FleetCar } from "@/lib/fleet-types";
import type { BookingCityBranchesOption } from "@/lib/booking-location-options";
import { useLocale, useTranslations } from "next-intl";

export type FleetCategoryTab = {
  slug: string;
  tabLabel: string;
  cars: FleetCar[];
};

type Props = { tabs: FleetCategoryTab[]; cities?: BookingCityBranchesOption[]; allowHolidayBooking?: boolean };

export function FleetCategoriesShowcase({ tabs, cities, allowHolidayBooking = false }: Props) {
  const t = useTranslations("FleetShowcase");
  /* الاتجاه من اللغة لا من `rtl:` — متغيّر Tailwind لا يُولَّد في هذا الإعداد. */
  const isRtl = useLocale() === "ar";
  /** سهم حافة البداية (يسار في LTR، يمين في RTL) — يشير دائماً للخارج. */
  const StartArrow = isRtl ? ChevronRight : ChevronLeft;
  const EndArrow = isRtl ? ChevronLeft : ChevronRight;
  /** سهم «عرض الكل»: جهة التقدّم في القراءة — عكس سهم حافة البداية. */
  const ForwardArrow = EndArrow;

  /**
   * تبويب «الكل» أولاً وهو المُحدَّد افتراضياً — الزائر يرى الأسطول كاملاً قبل أن
   * يضيّقه بنفسه. لا يُضاف مع فئة واحدة لأنه سيكرّرها حرفياً.
   * (الفئات الفارغة مُستبعدة من الخادم، فكل تبويب هنا له سيارات.)
   */
  const displayTabs = useMemo<FleetCategoryTab[]>(() => {
    if (tabs.length <= 1) return tabs;
    return [
      { slug: "all", tabLabel: t("allCategories"), cars: tabs.flatMap((tab) => tab.cars) },
      ...tabs,
    ];
  }, [tabs, t]);

  const [active, setActive] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScroll, setCanScroll] = useState(false);

  const current = displayTabs[active] ?? displayTabs[0];
  const cars = useMemo(() => current?.cars ?? [], [current]);

  const checkScrollability = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setCanScroll(el.scrollWidth > el.clientWidth + 4);
  }, []);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    checkScrollability();
    window.addEventListener("resize", checkScrollability, { passive: true });
    return () => window.removeEventListener("resize", checkScrollability);
  }, [checkScrollability, displayTabs]);

  /**
   * بمنطق البداية/النهاية لا اليمين/اليسار — الشريط يعمل في الاتجاهين. في RTL يبدأ
   * `scrollLeft` من صفر عند الحافة اليمنى ويصير سالباً نحو النهاية، فتنعكس الإشارة.
   */
  const handleScroll = (direction: "start" | "end") => {
    const el = scrollRef.current;
    if (!el) return;
    const isRtl = getComputedStyle(el).direction === "rtl";
    const step = direction === "end" ? 260 : -260;
    el.scrollBy({ left: isRtl ? -step : step, behavior: "smooth" });
  };

  /**
   * يُمركز التبويب داخل الشريط فقط. لا نستخدم `scrollIntoView` لأنها تحرّك كل
   * السلف القابلين للتمرير حتى الصفحة نفسها — فكان اختيار تبويب يُزيح الصفحة
   * كاملةً حين لا يكون الشريط قابلاً للتمرير أصلاً.
   * الحساب بفروق `getBoundingClientRect` ليعمل في الاتجاهين (RTL/LTR).
   */
  const centerTabInStrip = (tabEl: HTMLElement) => {
    const strip = scrollRef.current;
    if (!strip || strip.scrollWidth <= strip.clientWidth + 4) return;
    const stripRect = strip.getBoundingClientRect();
    const tabRect = tabEl.getBoundingClientRect();
    const delta =
      tabRect.left + tabRect.width / 2 - (stripRect.left + stripRect.width / 2);
    strip.scrollBy({ left: delta, behavior: "smooth" });
  };

  if (!current) return null;

  const hasCards = cars.length > 0;

  return (
    <div className="relative mx-auto max-w-screen-xl px-3 sm:px-8">
      <header className="mb-8 flex flex-col items-center text-center sm:mb-14">
        <div className="mb-3 flex items-center gap-3">
          <span className="h-px w-10 bg-gradient-to-l from-[#dbb878] to-transparent" />
          <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#dbb878]">
            {t("ourFleet")}
          </span>
          <span className="h-px w-10 bg-gradient-to-r from-[#dbb878] to-transparent" />
        </div>
        <h2
          id="fleet-categories-heading"
          className="max-w-4xl text-pretty text-xl font-black leading-tight tracking-wide text-[#0f1923] sm:text-3xl md:text-4xl lg:text-[2.35rem]"
        >
          {t("theRightVehicle")}
          <span className="mx-2 inline-block font-light text-[#003749]/35">|</span>
          {t("atTheRightTime")}
        </h2>
      </header>

      {/* Category Tabs Strip with Navigation Arrows */}
      <div className="relative mb-8 flex items-center justify-center sm:mb-12">
        {/* شريط واحد هادئ: الحدود على الحاوية فقط — الحدود المتداخلة (حاوية + أسهم
            + كل تبويب) كانت تجعل الشريط يبدو صفَّ أزرار لا مجموعة تبويبات. */}
        {/* `w-fit` لا `w-full`: الشريط ينكمش على تبويباته فلا يتبقّى فراغ داخله حين تقلّ
            الفئات، و`max-w-full` يحدّه بعرض الحاوية فيتولّى التمرير الأفقي عند كثرتها. */}
        <div className="relative flex w-fit max-w-full items-center gap-1 rounded-full border border-[#ece9e3] bg-[#faf9f6] p-1.5">
          {/* الأسهم تُخفى تماماً حين لا يوجد ما يُمرَّر — أفضل من إظهارها معطّلة. */}
          {canScroll ? (
            <button
              type="button"
              onClick={() => handleScroll("start")}
              aria-label="الفئات السابقة"
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-[#003749]/45 transition-colors duration-200 hover:bg-white hover:text-[#003749]"
            >
              <StartArrow className="size-[18px]" />
            </button>
          ) : null}

          {/* Scrollable Tabs Bar */}
          <div
            ref={scrollRef}
            role="tablist"
            aria-label="فئات الأسطول"
            className="no-scrollbar flex min-w-0 flex-1 items-center gap-2 overflow-x-auto scroll-smooth py-1 whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            {displayTabs.map((tab, i) => {
              const isOn = i === active;
              return (
                <button
                  key={tab.slug}
                  type="button"
                  role="tab"
                  aria-selected={isOn}
                  id={`fleet-cat-tab-${tab.slug}`}
                  aria-controls={`fleet-cat-panel-${tab.slug}`}
                  onClick={(e) => {
                    setActive(i);
                    centerTabInStrip(e.currentTarget);
                  }}
                  className={`min-h-[38px] shrink-0 rounded-full px-5 py-2 text-center text-[12.5px] tracking-wide transition-colors duration-200 ${
                    isOn
                      ? "bg-[#003749] font-bold text-white"
                      : "font-semibold text-[#0f1923]/65 hover:bg-white hover:text-[#003749]"
                  }`}
                >
                  {tab.tabLabel}
                </button>
              );
            })}
          </div>

          {canScroll ? (
            <button
              type="button"
              onClick={() => handleScroll("end")}
              aria-label="الفئات التالية"
              className="flex size-9 shrink-0 items-center justify-center rounded-full text-[#003749]/45 transition-colors duration-200 hover:bg-white hover:text-[#003749]"
            >
              <EndArrow className="size-[18px]" />
            </button>
          ) : null}
        </div>
      </div>

      {hasCards ? (
        <div
          role="tabpanel"
          id={`fleet-cat-panel-${current.slug}`}
          aria-labelledby={`fleet-cat-tab-${current.slug}`}
          className="grid grid-cols-1 gap-6 sm:gap-8 md:grid-cols-2 lg:grid-cols-3"
        >
          {cars.map((car) => (
            <FleetCarCard key={`${current.slug}-${car.modelId}`} car={car} cities={cities} allowHolidayBooking={allowHolidayBooking} />
          ))}
        </div>
      ) : (
        <div
          role="tabpanel"
          id={`fleet-cat-panel-${current.slug}`}
          aria-labelledby={`fleet-cat-tab-${current.slug}`}
          className="sr-only"
        >
          {t("noCarsAdded")}
        </div>
      )}

      <div className="mt-14 flex justify-center sm:mt-16">
        {/* يحمل الفئة المختارة إلى صفحة الأسطول (`?category=`) فتُفتح مُفلترة عليها. */}
        <Link
          href={`/fleet?category=${encodeURIComponent(current.slug)}`}
          className="inline-flex items-center gap-2 rounded-full border-2 border-[#003749]/18 bg-white px-8 py-3 text-sm font-extrabold text-[#003749] shadow-sm transition-colors hover:border-[#dbb878]/45 hover:bg-[#fdfbf6]"
        >
          {t("viewAll")}
          {/* يشير إلى جهة التقدّم في القراءة: يميناً في LTR ويساراً في RTL. */}
          <ForwardArrow className="size-4" strokeWidth={2.2} aria-hidden />
        </Link>
      </div>
    </div>
  );
}
