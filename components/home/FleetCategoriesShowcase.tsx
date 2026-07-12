"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FleetCarCard } from "@/components/fleet/FleetCarCard";
import type { FleetCar } from "@/lib/fleet-types";
import type { BookingCityBranchesOption } from "@/lib/booking-location-options";
import { useTranslations } from "next-intl";

const TEAL = "#003749";

export type FleetCategoryTab = {
  slug: string;
  tabLabel: string;
  cars: FleetCar[];
};

type Props = { tabs: FleetCategoryTab[]; cities?: BookingCityBranchesOption[] };

export function FleetCategoriesShowcase({ tabs, cities }: Props) {
  const firstWithCars = tabs.findIndex((t) => t.cars.length > 0);
  const [active, setActive] = useState(() => (firstWithCars >= 0 ? firstWithCars : 0));

  const current = tabs[active] ?? tabs[0];
  const cars = useMemo(() => current?.cars ?? [], [current]);
  const t = useTranslations("FleetShowcase");

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

      <div className="mb-8 flex justify-center sm:mb-12">
        <div
          role="tablist"
          aria-label="فئات الأسطول"
          className="flex w-full max-w-4xl items-center gap-2 overflow-x-auto overscroll-x-contain rounded-xl border border-[#e5e2dc] bg-white p-1.5 shadow-sm [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:justify-center sm:overflow-visible sm:rounded-2xl [&::-webkit-scrollbar]:hidden"
        >
          {tabs.map((tab, i) => {
            const isOn = i === active;
            return (
              <button
                key={tab.slug}
                type="button"
                role="tab"
                aria-selected={isOn}
                id={`fleet-cat-tab-${tab.slug}`}
                aria-controls={`fleet-cat-panel-${tab.slug}`}
                onClick={() => setActive(i)}
                className={`min-h-[44px] shrink-0 rounded-xl px-3 py-2.5 text-center text-[11px] font-extrabold tracking-wide transition-all duration-200 sm:flex-1 sm:px-5 sm:text-[12.5px] md:flex-none ${
                  isOn
                    ? "text-white shadow-md sm:shadow-none"
                    : "border border-[#ebe8e2] bg-white text-[#0f1923] hover:border-[#003749]/28 sm:border-0 sm:bg-transparent"
                }`}
                style={
                  isOn
                    ? {
                        background: `linear-gradient(135deg, ${TEAL} 0%, #004d63 100%)`,
                        boxShadow: "0 8px 22px -10px rgba(0,55,73,0.45)",
                      }
                    : undefined
                }
              >
                {tab.tabLabel}
              </button>
            );
          })}
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
            <FleetCarCard key={`${current.slug}-${car.modelId}`} car={car} cities={cities} />
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
        <Link
          href="/fleet"
          className="inline-flex items-center gap-2 rounded-full border-2 border-[#003749]/18 bg-white px-8 py-3 text-sm font-extrabold text-[#003749] shadow-sm transition-colors hover:border-[#dbb878]/45 hover:bg-[#fdfbf6]"
        >
          {t("viewFullFleet")}
          <svg viewBox="0 0 24 24" fill="none" className="size-4 rtl:rotate-180" aria-hidden>
            <path
              d="M15 18l-6-6 6-6"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </Link>
      </div>
    </div>
  );
}
