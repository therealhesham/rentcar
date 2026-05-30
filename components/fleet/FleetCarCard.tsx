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
    <article className="group relative flex flex-col overflow-hidden rounded-2xl bg-white shadow-[0_2px_14px_-4px_rgba(0,55,73,0.10)] ring-1 ring-neutral-200/70 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_14px_42px_-12px_rgba(0,55,73,0.16)] hover:ring-[#dbb878]/40">

      {/* ────── صورة السيارة + المعلومات فوقها ────── */}
      <div className="relative aspect-[16/10] overflow-hidden bg-gradient-to-br from-[#e8f4f5] to-[#cfe5e7]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={car.image}
          alt={car.alt}
          className="h-full w-full object-cover object-center transition-transform duration-700 group-hover:scale-[1.05]"
        />

        {/* تدرّج داكن أسفل الصورة لإبراز النص */}
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/75 via-black/25 to-transparent"
          aria-hidden
        />

        {/* شارة التصنيف / الباج */}
        {car.badge ? (
          <div className="absolute start-3 top-3 rounded-lg bg-white/95 px-2.5 py-1 text-[10px] font-extrabold text-[#003749] shadow-sm backdrop-blur-sm">
            {car.badge}
          </div>
        ) : null}

        {/* شارة الخصم */}
        {car.priceUi.discountLabelAr ? (
          <div className="absolute end-3 top-3 rounded-lg bg-[#c2410c] px-2 py-1 text-[10px] font-extrabold text-white shadow-sm">
            {car.priceUi.discountLabelAr}
          </div>
        ) : null}

        {/* الماركة + الاسم + السنة فوق الصورة */}
        <div className="absolute inset-x-0 bottom-0 p-4">
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#e6be82]">
            {car.brand}
          </p>
          <div className="mt-0.5 flex items-end justify-between gap-2">
            <h3 className="min-w-0 text-lg font-extrabold leading-tight tracking-tight text-white drop-shadow-sm">
              {car.name}
            </h3>
            {car.year ? (
              <span
                className="shrink-0 text-xs font-bold tabular-nums text-white/75"
                dir="ltr"
              >
                {car.year}
              </span>
            ) : null}
          </div>
        </div>
      </div>

      {/* ────── جسم البطاقة ────── */}
      <div className="flex flex-1 flex-col gap-3.5 p-4">

        {/* المواصفات */}
        {car.specs.length > 0 ? (
          <div className="flex items-center gap-3.5 border-b border-neutral-100 pb-3">
            {car.specs.map((s, i) => (
              <div
                key={`${car.id}-spec-${i}`}
                className="flex flex-col items-center gap-1.5 text-center"
              >
                <span className="text-[#003749]/60" aria-hidden>
                  <SpecIcon name={s.icon} className="size-5 shrink-0" />
                </span>
                <span className="text-[11px] font-extrabold tabular-nums text-[#1a2e35]">
                  {s.value}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {/* السعر */}
        <div className="flex items-end justify-between gap-2">
          <div className="min-w-0">
            {car.priceUi.originalPrimaryAmount ? (
              <p className="text-xs tabular-nums text-neutral-400 line-through">
                {car.priceUi.originalPrimaryAmount}{" "}
                <SarCurrencyGlyph className="inline h-[0.8em] w-[0.8em]" />
              </p>
            ) : null}
            <p className="flex items-baseline gap-1.5 tabular-nums">
              <span className="text-[1.7rem] font-black leading-none tracking-tight text-[#003749]">
                {car.priceUi.primaryAmount}
              </span>
              <SarCurrencyGlyph className="mb-0.5 h-4 w-4 shrink-0 text-[#003749]/70" />
            </p>
            {car.priceUi.primaryLabelAr ? (
              <p className="mt-0.5 text-[10px] font-semibold text-neutral-500">
                {car.priceUi.primaryLabelAr}
              </p>
            ) : null}
          </div>

          {car.priceUi.secondaryAmount ? (
            <div className="shrink-0 rounded-xl border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-end">
              <p className="flex items-baseline justify-end gap-1 tabular-nums">
                <span className="text-base font-extrabold text-[#003749]">
                  {car.priceUi.secondaryAmount}
                </span>
                <SarCurrencyGlyph className="mb-0.5 h-3 w-3 shrink-0 text-[#003749]/60" />
              </p>
              {car.priceUi.secondaryLabelAr ? (
                  <p className="text-[9px] font-bold text-neutral-500">
                  {car.priceUi.secondaryLabelAr}
                </p>
              ) : null}
            </div>
          ) : null}
        </div>

        {/* زر الحجز + الحاشية */}
        <div className="mt-auto space-y-2">
          <FleetBookNowButton modelId={car.modelId} />
          {car.priceUi.footnoteAr ? (
            <p className="text-center text-[10px] leading-relaxed text-neutral-500">
              {car.priceUi.footnoteAr}
            </p>
          ) : null}
        </div>
      </div>
    </article>
  );
}
