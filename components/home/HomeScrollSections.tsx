"use client";

import type { ReactNode } from "react";
import { MotionSection } from "./MotionSection";

type HomeScrollSectionsProps = {
  hero: ReactNode;
  fleetCategories: ReactNode;
  promoBanner: ReactNode;
  services: ReactNode;
  branches: ReactNode;
};

/** أقسام الصفحة الرئيسية: whileInView + انزلاق أفقي مثل AboutSection */
export function HomeScrollSections({
  hero,
  fleetCategories,
  promoBanner,
  services,
  branches,
}: HomeScrollSectionsProps) {
  return (
    <>
      {hero}
      <MotionSection className="relative z-0 w-full" delay={0} x={-50}>
        {fleetCategories}
      </MotionSection>
      <MotionSection className="relative z-0 w-full" delay={0.2} x={50}>
        {promoBanner}
      </MotionSection>
      <MotionSection className="relative z-0 w-full" delay={0.2} x={-50}>
        {services}
      </MotionSection>
      <MotionSection className="relative z-0 w-full" delay={0.2} x={50}>
        {branches}
      </MotionSection>
    </>
  );
}
