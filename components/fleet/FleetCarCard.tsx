"use client";

import { SpecIcon } from "@/components/icons";
import { FleetBookNowButton } from "@/components/fleet/FleetBookNowButton";
import type { FleetCar } from "@/lib/fleet-types";
import { SarCurrencyGlyph } from "@/components/ui/SarCurrencyGlyph";

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
    <article className="group flex flex-col overflow-hidden rounded-xl bg-white shadow-[0_4px_20px_rgba(0,52,58,0.10)] transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(0,52,58,0.16)]">

      {/* ────── صورة السيارة ────── */}
      <div className="relative h-60 overflow-hidden">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={car.image}
          alt={car.alt}
          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-110"
        />

        {/* الشارات أعلى اليمين (start في RTL) */}
        <div className="absolute start-4 top-4 flex flex-col items-start gap-2">
          {car.year ? (
            <span
              className="rounded-full bg-[#003749]/90 px-3 py-1 text-[11px] font-bold tabular-nums text-white shadow-sm backdrop-blur-sm"
              dir="ltr"
            >
              {car.year}
            </span>
          ) : null}
          {car.badge ? (
            <span className="rounded-full bg-[#dbb878] px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[#003749] shadow-sm">
              {car.badge}
            </span>
          ) : null}
          {car.priceUi.discountLabelAr ? (
            <span className="rounded-full bg-[#c2410c] px-3 py-1 text-[11px] font-extrabold text-white shadow-sm">
              {car.priceUi.discountLabelAr}
            </span>
          ) : null}
        </div>
      </div>

      {/* ────── جسم البطاقة ────── */}
      <div className="flex flex-1 flex-col p-6">

        {/* الماركة + الاسم + المواصفات */}
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <span className="text-[12px] font-bold uppercase tracking-[0.2em] text-neutral-400">
              {car.brand}
            </span>
            <h3 className="mt-0.5 truncate text-2xl font-extrabold leading-tight text-[#003749]">
              {car.name}
            </h3>
          </div>

          {car.specs.length > 0 ? (
            <div className="flex shrink-0 gap-4">
              {car.specs.map((s, i) => (
                <div
                  key={`${car.id}-spec-${i}`}
                  className="flex flex-col items-center gap-0.5"
                >
                  <span className="text-neutral-400" aria-hidden>
                    <SpecIcon name={s.icon} className="size-6 shrink-0" />
                  </span>
                  <span className="text-[10px] font-bold tabular-nums text-neutral-500">
                    {s.value}
                  </span>
                </div>
              ))}
            </div>
          ) : null}
        </div>

        {/* السعر + الزر */}
        <div className="mt-auto border-t border-neutral-100 pt-6">
          <div className="mb-6 flex items-end justify-between gap-3">
            <div className="flex min-w-0 flex-col">
              {car.priceUi.originalPrimaryAmount ? (
                <span className="flex items-baseline gap-1 text-xs tabular-nums text-neutral-400 line-through">
                  {car.priceUi.originalPrimaryAmount}
                  <SarCurrencyGlyph className="h-[0.75em] w-[0.75em]" />
                </span>
              ) : null}
              <div className="flex items-baseline gap-1.5 tabular-nums">
                <span className="text-[28px] font-extrabold leading-none tracking-tight text-[#003749]">
                  {car.priceUi.primaryAmount}
                </span>
                <SarCurrencyGlyph className="h-4 w-4 shrink-0 text-[#003749]" />
              </div>
              {car.priceUi.primaryLabelAr ? (
                <span className="mt-1 text-xs text-neutral-500">
                  {car.priceUi.primaryLabelAr}
                </span>
              ) : null}
              {car.priceUi.secondaryAmount ? (
                <span className="mt-1 flex items-baseline gap-1 text-[11px] font-semibold tabular-nums text-neutral-500">
                  {car.priceUi.secondaryAmount}
                  <SarCurrencyGlyph className="h-[0.7em] w-[0.7em]" />
                  {car.priceUi.secondaryLabelAr ? (
                    <span className="font-normal">· {car.priceUi.secondaryLabelAr}</span>
                  ) : null}
                </span>
              ) : null}
            </div>

            {car.priceUi.footnoteAr ? (
              <span className="max-w-[8rem] text-end text-[10px] italic leading-relaxed text-neutral-400">
                {car.priceUi.footnoteAr}
              </span>
            ) : null}
          </div>

          <FleetBookNowButton modelId={car.modelId} />
        </div>
      </div>
    </article>
  );
}
