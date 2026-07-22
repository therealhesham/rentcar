"use client";

import { SpecIcon } from "@/components/icons";
import { FleetBookNowButton } from "@/components/fleet/FleetBookNowButton";
import type { FleetCar } from "@/lib/fleet-types";
import type { BookingCityBranchesOption } from "@/lib/booking-location-options";
import { SarCurrencyGlyph } from "@/components/ui/SarCurrencyGlyph";

/** تسمية عربية مختصرة لكل مواصفة حسب اسم الأيقونة */
const SPEC_LABEL_AR: Record<string, string> = {
  airline_seat_recline_extra: "مقاعد",
  door_open: "أبواب",
  luggage: "حقائب",
  mode_fan: "A/C",
  bolt: "كهرباء",
  speed: "سرعة",
  timer: "وقت",
};

/** يستخرج «الوقود» و«ناقل الحركة» من subtitle: "السنة • الوقود • الناقل" */
function metaFromSubtitle(subtitle: string): string[] {
  return subtitle
    .split("•")
    .map((s) => s.trim())
    .filter(Boolean)
    .filter((s) => !/^\d{4}$/.test(s));
}

/** أيقونة حفظ */
function BookmarkIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" className="h-3.5 w-3.5" aria-hidden>
      <path
        d="M19 21l-7-5-7 5V5a2 2 0 012-2h10a2 2 0 012 2v16z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function FleetCarCard({
  car,
  cities,
}: {
  car: FleetCar;
  cities?: BookingCityBranchesOption[];
}) {
  const meta = metaFromSubtitle(car.subtitle);

  return (
    <article
      dir="rtl"
      className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
    >
      {/* ────── الرأس: الاسم يمين، الفئة يسار ────── */}
      <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-2">

        {/* الاسم + السنة + أو مشابهة */}
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold leading-snug text-gray-900">
            {car.brand} {car.name}
            {car.year ? (
              <span className="mr-1 text-sm font-normal text-gray-400">
                {car.year}
              </span>
            ) : null}
          </h3>
          <p className="text-[12px] font-medium text-gray-500">أو مشابهة</p>

          {meta.length > 0 ? (
            <p className="mt-0.5 text-[11px] text-gray-400">
              {meta.join(" · ")}
            </p>
          ) : null}
        </div>

        {/* شارة الفئة */}
        {car.badge ? (
          <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-gray-100 px-2.5 py-1 text-[11px] font-semibold text-gray-600">
            <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-gray-400" />
            {car.badge}
          </span>
        ) : car.priceUi.discountLabelAr ? (
          <span className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-600">
            {car.priceUi.discountLabelAr}
          </span>
        ) : null}
      </div>

      {/* ────── صورة السيارة ────── */}
      <div className="relative flex h-48 w-full items-center justify-center overflow-hidden bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={car.image}
          alt={car.alt}
          loading="lazy"
          className="h-full w-full object-contain transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        />
        {car.badge && car.priceUi.discountLabelAr ? (
          <span className="absolute top-4 left-4 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
            {car.priceUi.discountLabelAr}
          </span>
        ) : null}
      </div>

      {/* ────── شريط المواصفات الأفقي ────── */}
      {car.specs.length > 0 ? (
        <div className="mx-4 mt-3 flex items-center justify-center gap-4 border-t border-b border-gray-100 py-2.5">
          {car.specs.map((s, i) => (
            <div
              key={`${car.id}-spec-${i}`}
              className="flex items-center gap-1"
            >
              {i > 0 && (
                <span className="mr-3 ml-0 h-4 w-px bg-gray-200" />
              )}
              <SpecIcon
                name={s.icon}
                className="h-4 w-4 shrink-0 text-gray-500"
              />
              <span className="text-[13px] font-bold tabular-nums text-gray-800">
                {s.value}
              </span>
              <span className="text-[10px] font-medium text-gray-400">
                {SPEC_LABEL_AR[s.icon] ?? ""}
              </span>
            </div>
          ))}
        </div>
      ) : null}

      {/* ────── السعر + زر الحجز في نفس الصف ────── */}
      <div className="flex items-end justify-between gap-3 px-4 pt-3 pb-1">

        {/* السعر — يمين */}
        <div className="flex flex-col">
          {car.priceUi.primaryLabelAr && (
            <p className="text-[12px] font-medium text-gray-500">
              {car.priceUi.primaryLabelAr}
            </p>
          )}
          {car.priceUi.footnoteAr && (
            <p className="text-[12px] text-gray-400">{car.priceUi.footnoteAr}</p>
          )}
          <div className="mt-0.5 flex items-baseline gap-1.5">
            {car.priceUi.prefixLabelAr ? (
              <span className="text-[12px] font-semibold text-gray-500">
                {car.priceUi.prefixLabelAr}
              </span>
            ) : null}
            {car.priceUi.originalPrimaryAmount ? (
              <span className="flex items-baseline gap-0.5 text-sm text-gray-400 line-through">
                {car.priceUi.originalPrimaryAmount}
                <SarCurrencyGlyph className="h-[0.7em] w-[0.7em]" />
              </span>
            ) : null}
            <span className="text-[26px] font-extrabold leading-none tracking-tight text-gray-900">
              {car.priceUi.primaryAmount}
            </span>
            <SarCurrencyGlyph className="h-4 w-4 shrink-0 text-gray-700" />
            {car.priceUi.periodLabelAr && car.priceUi.primaryLabelAr !== car.priceUi.periodLabelAr ? (
              <span className="text-[12px] font-semibold text-gray-500">
                / {car.priceUi.periodLabelAr}
              </span>
            ) : null}
          </div>
          {car.priceUi.secondaryAmount && (
            <p className="mt-0.5 flex items-baseline gap-1 text-[11px] text-gray-500">
              {car.priceUi.secondaryAmount}
              <SarCurrencyGlyph className="h-[0.65em] w-[0.65em]" />
              {car.priceUi.secondaryLabelAr && (
                <span>· {car.priceUi.secondaryLabelAr}</span>
              )}
            </p>
          )}
        </div>

        {/* زر الحجز — يسار */}
        <div className="shrink-0 [&_a]:!w-auto [&_button]:!w-auto">
          <FleetBookNowButton
            modelId={car.modelId}
            cities={cities}
            carName={`${car.brand} ${car.name}`}
          />
        </div>
      </div>

      {/* ────── حفظ للمرة القادمة ────── */}
      <div className="flex justify-end px-4 pb-3 pt-1">
        <button
          type="button"
          className="flex items-center gap-1 text-[11px] text-gray-400 transition-colors hover:text-gray-600"
        >
          <BookmarkIcon />
          <span className="whitespace-nowrap">حفظ للمرة القادمة</span>
        </button>
      </div>
    </article>
  );
}
