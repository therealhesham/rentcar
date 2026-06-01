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

/** تسمية عربية مختصرة لكل مواصفة حسب اسم الأيقونة */
const SPEC_LABEL_AR: Record<string, string> = {
  airline_seat_recline_extra: "مقاعد",
  door_open: "أبواب",
  luggage: "حقائب",
};

/** يستخرج «الوقود» و«ناقل الحركة» من subtitle: "السنة • الوقود • الناقل" */
function metaFromSubtitle(subtitle: string): string[] {
  return subtitle
    .split("•")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !/^\d{4}$/.test(s));
}

export function FleetCarCard({
  car,
  branchOptions: _branchOptions = FALLBACK_BRANCH_OPTIONS,
}: {
  car: FleetCar;
  branchOptions?: { slug: string; name: string }[];
}) {
  const meta = metaFromSubtitle(car.subtitle);

  return (
    <article className="group flex flex-col overflow-hidden rounded-2xl border border-[#003749]/[0.06] bg-white shadow-[0_4px_20px_rgba(0,52,58,0.08)] transition-all duration-300 hover:-translate-y-1.5 hover:border-[#dbb878]/40 hover:shadow-[0_18px_40px_-12px_rgba(0,52,58,0.22)]">

      {/* ────── صورة السيارة ────── */}
      <div className="relative h-56 overflow-hidden bg-gradient-to-br from-[#003749]/[0.04] to-[#dbb878]/[0.06]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={car.image}
          alt={car.alt}
          loading="lazy"
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.08]"
        />

        {/* تدرّج سفلي خفيف لإبراز الشارات وتنعيم الحافة */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/25 to-transparent" />

        {/* الشارات أعلى البطاقة */}
        <div className="absolute inset-x-4 top-4 flex items-start justify-between gap-2">
          <div className="flex flex-col items-start gap-2">
            {car.badge ? (
              <span className="rounded-full bg-[#dbb878] px-3 py-1 text-[11px] font-extrabold uppercase tracking-wide text-[#003749] shadow-sm">
                {car.badge}
              </span>
            ) : null}
            {car.priceUi.discountLabelAr ? (
              <span className="inline-flex items-center gap-1 rounded-full bg-[#c2410c] px-3 py-1 text-[11px] font-extrabold text-white shadow-sm">
                <svg viewBox="0 0 24 24" fill="none" className="h-3 w-3" aria-hidden>
                  <path d="M9 9h.01M15 15h.01M16 8l-8 8M3 7v3.586a1 1 0 00.293.707l9.414 9.414a1 1 0 001.414 0l5.586-5.586a1 1 0 000-1.414L10.293 4.293A1 1 0 009.586 4H6a3 3 0 00-3 3z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                {car.priceUi.discountLabelAr}
              </span>
            ) : null}
          </div>

          {car.year ? (
            <span
              className="rounded-full bg-white/90 px-3 py-1 text-[11px] font-extrabold tabular-nums text-[#003749] shadow-sm ring-1 ring-black/5 backdrop-blur-sm"
              dir="ltr"
            >
              {car.year}
            </span>
          ) : null}
        </div>
      </div>

      {/* ────── جسم البطاقة ────── */}
      <div className="flex flex-1 flex-col p-5">

        {/* الماركة + الاسم */}
        <div className="min-w-0">
          <span className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#dbb878]">
            {car.brand}
          </span>
          <h3 className="mt-1 truncate text-xl font-extrabold leading-tight text-[#003749]">
            {car.name}
          </h3>
          {meta.length > 0 ? (
            <p className="mt-1 truncate text-[12px] font-medium text-neutral-500">
              {meta.join(" · ")}
            </p>
          ) : null}
        </div>

        {/* شريط المواصفات */}
        {car.specs.length > 0 ? (
          <div className="mt-4 grid grid-cols-3 gap-2 rounded-xl border border-neutral-100 bg-neutral-50/70 p-3">
            {car.specs.map((s, i) => (
              <div
                key={`${car.id}-spec-${i}`}
                className="flex flex-col items-center gap-1 text-center"
              >
                <SpecIcon name={s.icon} className="size-5 shrink-0 text-[#003749]/70" />
                <span className="text-[13px] font-extrabold tabular-nums leading-none text-[#003749]">
                  {s.value}
                </span>
                <span className="text-[10px] font-medium text-neutral-400">
                  {SPEC_LABEL_AR[s.icon] ?? ""}
                </span>
              </div>
            ))}
          </div>
        ) : null}

        {/* السعر + الزر */}
        <div className="mt-auto border-t border-neutral-100 pt-4">
          <div className="mb-4 flex items-end justify-between gap-3">
            <div className="flex min-w-0 flex-col">
              {car.priceUi.originalPrimaryAmount ? (
                <span className="flex items-baseline gap-1 text-xs tabular-nums text-neutral-400 line-through">
                  {car.priceUi.originalPrimaryAmount}
                  <SarCurrencyGlyph className="h-[0.75em] w-[0.75em]" />
                </span>
              ) : null}
              <div className="flex items-baseline gap-1.5 tabular-nums">
                <span className="text-[27px] font-extrabold leading-none tracking-tight text-[#003749]">
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

          <FleetBookNowButton modelId={car.modelId} branchOptions={_branchOptions} />
        </div>
      </div>
    </article>
  );
}
