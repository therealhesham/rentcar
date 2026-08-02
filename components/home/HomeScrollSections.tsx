"use client";

import type { ReactNode } from "react";
import { MotionSection } from "./MotionSection";

type HomeScrollSectionsProps = {
  hero: ReactNode;
  fleetCategories: ReactNode;
  promoBanner: ReactNode;
  services: ReactNode;
  fleetBanner: ReactNode;
  branches: ReactNode;
  homeCta: ReactNode;
};

/** أقسام الصفحة الرئيسية: whileInView + انزلاق أفقي مثل AboutSection */
export function HomeScrollSections({
  hero,
  fleetCategories,
  promoBanner,
  services,
  fleetBanner,
  branches,
  homeCta,
}: HomeScrollSectionsProps) {
  return (
    <>
      {hero}
      <MotionSection className="relative z-0 w-full">
        {fleetCategories}
      </MotionSection>
      {promoBanner && (
        <MotionSection className="relative z-0 w-full">
          {promoBanner}
        </MotionSection>
      )}
      <MotionSection className="relative z-0 w-full">
        {services}
      </MotionSection>
      <MotionSection className="relative z-0 w-full">
        {fleetBanner}
      </MotionSection>
      <MotionSection className="relative z-0 w-full">
        {branches}
      </MotionSection>
      <MotionSection className="relative z-0 w-full">
        {homeCta}
      </MotionSection>
    </>
  );
}
