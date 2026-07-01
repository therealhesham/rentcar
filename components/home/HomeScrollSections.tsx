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
 * بحيث يبقى "sticky" أثناء التمرير عبر الصفحة كلها (من sm فأعلى فقط) ولا يختفي إلا عند الوصول للفوتر.
 * على الموبايل يبقى ضمن التدفق العادي حتى لا يغطي الشاشة.
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
      {/* على الموبايل: ال widget أولاً ثم ال hero (عبر order)، ومن sm يعود الترتيب الطبيعي */}
      <div className="relative flex flex-col">
        <div className="order-2 sm:order-1">{hero}</div>

        <HeroEntrance
          delay={0.1}
          className={`order-1 z-30 scroll-mt-24 px-3 pb-4 pt-[5.25rem] sm:order-2 sm:-mt-2 sm:px-6 sm:pb-8 sm:pt-0 lg:px-8 ${
            stickyEligible ? "relative sm:sticky sm:top-24" : "relative"
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

        <div className="order-3">
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
      </div>
    </>
  );
}
