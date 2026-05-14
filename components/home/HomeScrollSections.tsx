"use client";

import type { ReactNode } from "react";
import { Reveal } from "./HomeMotion";

type HomeScrollSectionsProps = {
  hero: ReactNode;
  fleetCategories: ReactNode;
  promoBanner: ReactNode;
  services: ReactNode;
  branches: ReactNode;
};

/** أقسام الصفحة الرئيسية مع ظهور تدريجي عند التمرير (framer-motion) */
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
      <Reveal delay={0.02}>{fleetCategories}</Reveal>
      <Reveal delay={0.05}>{promoBanner}</Reveal>
      <Reveal delay={0.08}>{services}</Reveal>
      <Reveal delay={0.11}>{branches}</Reveal>
    </>
  );
}
