"use client";

import { useState } from "react";
import type { ReactNode } from "react";
import { MotionSection } from "./MotionSection";
import { HeroEntrance } from "./HomeMotion";
import { BookingWidget, type BookingCityBranchesOption } from "./BookingWidget";
import type { BookingWidgetTabFlags } from "@/lib/booking-widget-tabs";

type HomeScrollSectionsProps = {
  hero: ReactNode;
  cities: BookingCityBranchesOption[];
  tabFlags?: BookingWidgetTabFlags | null;
  fleetCategories: ReactNode;
  promoBanner: ReactNode;
  services: ReactNode;
  fleetBanner: ReactNode;
  branches: ReactNode;
  homeCta: ReactNode;
};

/**
 * أقسام الصفحة الرئيسية: whileInView + انزلاق أفقي مثل AboutSection.
 * ال widget موضوع داخل نفس الحاوية الطويلة التي تضم بقية الأقسام،
 * بحيث يبقى "sticky" أثناء التمرير عبر الصفحة كلها ولا يختفي إلا عند الوصول للفوتر.
 * يُستثنى تبويبا الشركات والباقات الشهرية (نموذج طويل يحتاج تمرير كامل).
 */
export function HomeScrollSections({
  hero,
  cities,
  tabFlags,
  fleetCategories,
  promoBanner,
  services,
  fleetBanner,
  branches,
  homeCta,
}: HomeScrollSectionsProps) {
  const [stickyEligible, setStickyEligible] = useState(true);

  return (
    <>
      {hero}
      <div className="relative">
        <HeroEntrance
          delay={0.1}
          className={`z-30 -mt-1 scroll-mt-24 px-3 pb-6 sm:-mt-2 sm:px-6 sm:pb-8 lg:px-8 ${
            stickyEligible ? "sticky top-[4.5rem] sm:top-24" : "relative"
          }`}
        >
          <div id="home-booking" className="mx-auto w-full max-w-[72rem]" dir="rtl">
            <BookingWidget
              cities={cities}
              tabFlags={tabFlags}
              onStickyEligibleChange={setStickyEligible}
            />
          </div>
        </HeroEntrance>

        <MotionSection className="relative z-0 w-full" delay={0} x={-50}>
          {fleetCategories}
        </MotionSection>
        <MotionSection className="relative z-0 w-full" delay={0.2} x={50}>
          {promoBanner}
        </MotionSection>
        <MotionSection className="relative z-0 w-full" delay={0.2} x={-50}>
          {services}
        </MotionSection>
        <MotionSection className="relative z-0 w-full" delay={0.15} x={50}>
          {fleetBanner}
        </MotionSection>
        <MotionSection className="relative z-0 w-full" delay={0.2} x={-50}>
          {branches}
        </MotionSection>
        <MotionSection className="relative z-0 w-full" delay={0.15} x={50}>
          {homeCta}
        </MotionSection>
      </div>
    </>
  );
}
