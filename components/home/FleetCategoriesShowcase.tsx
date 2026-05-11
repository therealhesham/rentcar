"use client";

import { Briefcase, Users } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

const GOLD = "#dbb878";
const GOLD_DARK = "#c9a356";
const TEAL = "#003749";

export type FleetCategoryCard = {
  id: string;
  eyebrow: string;
  detailLine: string;
  image: string;
  alt: string;
  seats: number | null;
  luggageLabel: string | null;
};

export type FleetCategoryTab = {
  slug: string;
  tabLabel: string;
  cards: FleetCategoryCard[];
};

type Props = { tabs: FleetCategoryTab[] };

export function FleetCategoriesShowcase({ tabs }: Props) {
  const firstWithCars = tabs.findIndex((t) => t.cards.length > 0);
  const [active, setActive] = useState(() => (firstWithCars >= 0 ? firstWithCars : 0));

  const current = tabs[active] ?? tabs[0];
  const cards = useMemo(() => current?.cards ?? [], [current]);

  if (!current) return null;

  const hasCards = cards.length > 0;

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
          className="grid grid-cols-1 gap-10 md:grid-cols-3 md:gap-0"
        >
          {cards.map((card, idx) => (
            <article
              key={card.id}
              className={`flex flex-col px-0 md:px-5 lg:px-7 ${
                idx > 0
                  ? "border-t border-[#e8e4dc] pt-10 md:border-t-0 md:border-s md:border-[#e8e4dc] md:pt-0"
                  : ""
              }`}
            >
              <h3 className="text-center text-[14px] font-extrabold leading-snug tracking-wide text-[#0f1923] sm:text-[15px]">
                {card.eyebrow}
              </h3>

              <div className="relative mt-6 aspect-[2.15/1] w-full max-w-[400px] justify-self-center md:max-w-full">
                <Image
                  src={card.image}
                  alt={card.alt}
                  fill
                  className="object-contain object-center"
                  sizes="(min-width: 1024px) 28vw, (min-width: 768px) 30vw, 92vw"
                  priority={idx === 0}
                />
              </div>

              <p className="mt-6 text-center text-[13px] font-semibold leading-relaxed text-[#6b7280] sm:text-[14px]">
                {card.detailLine}
              </p>

              {card.seats != null || card.luggageLabel ? (
                <div className="mt-6 flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-[13px] font-bold text-[#374151]">
                  {card.seats != null ? (
                    <span className="inline-flex items-center gap-2 tabular-nums">
                      <Users className="size-[18px] shrink-0 text-[#003749]/75" aria-hidden />
                      <span dir="ltr">{card.seats}</span>
                      <span className="font-semibold text-[#6b7280]">مقاعد</span>
                    </span>
                  ) : null}
                  {card.luggageLabel ? (
                    <span className="inline-flex items-center gap-2">
                      <Briefcase className="size-[18px] shrink-0 text-[#003749]/75" aria-hidden />
                      <span>{card.luggageLabel}</span>
                    </span>
                  ) : null}
                </div>
              ) : null}

              <div className="mt-9 grid grid-cols-2 gap-3">
                <Link
                  href={`/fleet?category=${encodeURIComponent(current.slug)}`}
                  className="inline-flex min-h-[48px] items-center justify-center rounded-xl border-2 border-[#0f1923] bg-white px-2 text-center text-[11px] font-extrabold uppercase tracking-wide text-[#0f1923] transition-colors hover:border-[#003749] hover:bg-[#fdfbf6] sm:px-3 sm:text-[12px]"
                >
                  تفاصيل الفئة
                </Link>
                <Link
                  href={`/fleet?category=${encodeURIComponent(current.slug)}`}
                  className="inline-flex min-h-[48px] items-center justify-center rounded-xl px-2 text-center text-[11px] font-extrabold uppercase tracking-wide text-white shadow-[0_10px_26px_-12px_rgba(201,163,86,0.65)] transition-[transform,box-shadow] hover:shadow-[0_14px_34px_-12px_rgba(201,163,86,0.75)] active:scale-[0.99] sm:px-3 sm:text-[12px]"
                  style={{
                    background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLD_DARK} 100%)`,
                  }}
                >
                  احجز الآن
                </Link>
              </div>
            </article>
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
