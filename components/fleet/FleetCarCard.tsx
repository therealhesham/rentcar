"use client";

import { SpecIcon } from "@/components/icons";
import { FleetBookNowButton } from "@/components/fleet/FleetBookNowButton";
import type { FleetCar } from "@/lib/fleet-types";
import { SarAmountWithSymbol } from "@/components/ui/SarAmountWithSymbol";

const FALLBACK_BRANCH_OPTIONS: { slug: string; name: string }[] = [
  { slug: "jeddah", name: "جدة" },
  { slug: "madinah", name: "المدينة المنورة" },
  { slug: "tabuk", name: "تبوك" },
];

export function FleetCarCard({
  car,
  branchOptions: _branchOptions = FALLBACK_BRANCH_OPTIONS,
}: {
  car: FleetCar;
  branchOptions?: { slug: string; name: string }[];
}) {
  void _branchOptions;

  return (
    <article className="group overflow-hidden rounded-[18px] border border-outline-variant/50 bg-surface-container-lowest shadow-sm transition-shadow hover:shadow-md">
      <div className="relative aspect-[5/3] bg-surface-container-lowest">
        {/* eslint-disable-next-line @next/next/no-img-element -- روابط صور ديناميكية من الإدارة */}
        <img
          src={car.image}
          alt={car.alt}
          className="h-full w-full object-cover object-center transition-transform duration-500 group-hover:scale-[1.03]"
        />
        {car.badge ? (
          <div className="absolute start-4 top-4 rounded-md rounded-es-none bg-primary-fixed px-3 py-1.5 text-xs font-bold text-on-primary-fixed shadow-sm">
            {car.badge}
          </div>
        ) : null}
      </div>

      <div className="space-y-4 bg-surface-container-low px-5 pb-5 pt-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="min-w-0 text-start text-lg font-extrabold leading-snug text-on-primary-container">
            <span className="text-on-primary-container">{car.brand}</span>
            <span className="mx-1.5 font-bold text-on-primary-container/50" aria-hidden>
              |
            </span>
            <span className="text-on-primary-container">{car.name}</span>
          </h3>
          <p className="shrink-0 pt-0.5 text-base font-semibold text-on-surface tabular-nums">
            {car.year}
          </p>
        </div>

        <div className="flex items-end justify-between gap-4">
          <div className="flex flex-1 justify-start gap-6 sm:gap-8">
            {car.specs.map((s, i) => (
              <div
                key={`${car.id}-spec-${i}`}
                className="flex flex-col items-center gap-1.5 text-center"
              >
                <span className="text-primary-fixed-dim" aria-hidden>
                  <SpecIcon name={s.icon} className="size-7 shrink-0" />
                </span>
                <span className="text-sm font-bold tabular-nums text-on-surface">{s.value}</span>
              </div>
            ))}
          </div>
          <div className="flex shrink-0 flex-col items-end gap-0.5 text-end">
            {car.priceUi.discountLabelAr ? (
              <span className="rounded-md bg-[#c2410c]/10 px-2 py-0.5 text-[10px] font-extrabold text-[#c2410c]">
                {car.priceUi.discountLabelAr}
              </span>
            ) : null}
            {car.priceUi.originalPrimaryAmount ? (
              <SarAmountWithSymbol
                amountClassName="text-sm font-bold text-on-surface-variant line-through opacity-70"
              >
                {car.priceUi.originalPrimaryAmount}
              </SarAmountWithSymbol>
            ) : null}
            <SarAmountWithSymbol
              bold
              amountClassName="text-2xl font-extrabold tracking-tight text-on-surface"
            >
              {car.priceUi.primaryAmount}
            </SarAmountWithSymbol>
            {car.priceUi.primaryLabelAr ? (
              <p className="text-[10px] font-bold text-on-surface-variant">{car.priceUi.primaryLabelAr}</p>
            ) : null}
            {car.priceUi.secondaryAmount ? (
              <div className="mt-1.5 w-full border-t border-outline-variant/40 pt-1.5">
                <SarAmountWithSymbol
                  bold
                  amountClassName="text-lg font-extrabold tracking-tight text-on-surface"
                >
                  {car.priceUi.secondaryAmount}
                </SarAmountWithSymbol>
                {car.priceUi.secondaryLabelAr ? (
                  <p className="text-[10px] font-bold text-on-surface-variant">{car.priceUi.secondaryLabelAr}</p>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>

        <div className="space-y-2.5">
          <FleetBookNowButton modelId={car.modelId} />
          <p className="text-center text-[11px] font-semibold leading-relaxed text-on-primary-container">
            {car.priceUi.footnoteAr}
          </p>
        </div>
      </div>
    </article>
  );
}
