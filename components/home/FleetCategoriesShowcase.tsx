"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { FleetCarCard } from "@/components/fleet/FleetCarCard";
import type { FleetCar } from "@/lib/fleet-types";

const TEAL = "#003749";

export type FleetCategoryTab = {
  slug: string;
  tabLabel: string;
  cars: FleetCar[];
};

type Props = { tabs: FleetCategoryTab[] };

export function FleetCategoriesShowcase({ tabs }: Props) {
  const firstWithCars = tabs.findIndex((t) => t.cars.length > 0);
  const [active, setActive] = useState(() => (firstWithCars >= 0 ? firstWithCars : 0));

  const current = tabs[active] ?? tabs[0];
  const cars = useMemo(() => current?.cars ?? [], [current]);

  if (!current) return null;

  const hasCards = cars.length > 0;

  return (
    <div className="relative mx-auto max-w-screen-xl px-4 sm:px-8">
      <header className="mb-10 flex flex-col items-center text-center sm:mb-14">
        <h2
          id="fleet-categories-heading"
          className="max-w-4xl text-pretty text-2xl font-black leading-tight tracking-wide text-[#0f1923] sm:text-3xl md:text-4xl lg:text-[2.35rem]"
        >
          المركبة المناسبة
          <span className="mx-2 inline-block font-light text-[#003749]/35">|</span>
          في الوقت المناسب
        </h2>
        <p className="mt-4 max-w-2xl text-pretty text-[15px] font-medium leading-relaxed text-[#5c6570] sm:text-base">
          من المشاوير السريعة إلى العطلات الطويلة — اكتشف فئات أسطولنا المصممة لتناسب كل رحلة، مع
          أسعار واضحة وتجربة حجز سلسة.
        </p>
      </header>

      <div className="mb-12 flex justify-center">
        <div
          role="tablist"
          aria-label="فئات الأسطول"
          className="flex w-full max-w-4xl flex-wrap items-center justify-center gap-2 sm:gap-0 sm:rounded-2xl sm:border sm:border-[#e5e2dc] sm:bg-white sm:p-1.5 sm:shadow-sm"
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
                className={`min-h-[44px] flex-1 rounded-xl px-3 py-2.5 text-center text-[11px] font-extrabold tracking-wide transition-all duration-200 sm:flex-none sm:px-5 sm:text-[12.5px] ${
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
          className="grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-3"
        >
          {cars.map((car) => (
            <FleetCarCard key={`${current.slug}-${car.modelId}`} car={car} />
          ))}
        </div>
      ) : (
        <div
          role="tabpanel"
          id={`fleet-cat-panel-${current.slug}`}
          aria-labelledby={`fleet-cat-tab-${current.slug}`}
          className="sr-only"
        >
          لا توجد مركبات مضافة لهذه الفئة بعد.
        </div>
      )}

      <div className="mt-14 flex justify-center sm:mt-16">
        <Link
          href="/fleet"
          className="inline-flex items-center gap-2 rounded-full border-2 border-[#003749]/18 bg-white px-8 py-3 text-sm font-extrabold text-[#003749] shadow-sm transition-colors hover:border-[#dbb878]/45 hover:bg-[#fdfbf6]"
        >
          عرض كامل الأسطول
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
