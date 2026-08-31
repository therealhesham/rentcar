"use client";

import { useLocale, useTranslations } from "next-intl";
import { SpecIcon } from "@/components/icons";
import { FleetBookNowButton } from "@/components/fleet/FleetBookNowButton";
import type { FleetCar } from "@/lib/fleet-types";
import type { BookingCityBranchesOption } from "@/lib/booking-location-options";
import { SarCurrencyGlyph } from "@/components/ui/SarCurrencyGlyph";
import {
  NATIONAL_DAY_PROMO_DATE_RANGE_AR,
  NATIONAL_DAY_PROMO_LABEL_AR,
  isNationalDayPromoActive,
} from "@/lib/national-day-promo";

const SPEC_KEY_MAP: Record<string, string> = {
  airline_seat_recline_extra: "seats",
  door_open: "doors",
  luggage: "bags",
  mode_fan: "ac",
  bolt: "electric",
  speed: "speed",
  timer: "time",
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
  allowHolidayBooking = false,
}: {
  car: FleetCar;
  cities?: BookingCityBranchesOption[];
  allowHolidayBooking?: boolean;
}) {
  const locale = useLocale();
  const t = useTranslations("FleetCard");
  const isEn = locale === "en";
  const meta = metaFromSubtitle(car.subtitle);

  const primaryLabel = isEn
    ? car.priceUi.primaryLabelEn ?? car.priceUi.primaryLabelAr
    : car.priceUi.primaryLabelAr;
  const secondaryLabel = isEn
    ? car.priceUi.secondaryLabelEn ?? car.priceUi.secondaryLabelAr
    : car.priceUi.secondaryLabelAr;
  const footnote = isEn
    ? car.priceUi.footnoteEn ?? car.priceUi.footnoteAr
    : car.priceUi.footnoteAr;
  const prefixLabel = isEn
    ? car.priceUi.prefixLabelEn ?? car.priceUi.prefixLabelAr
    : car.priceUi.prefixLabelAr;
  const periodLabel = isEn
    ? car.priceUi.periodLabelEn ?? car.priceUi.periodLabelAr
    : car.priceUi.periodLabelAr;
  const discountLabel = isEn
    ? car.priceUi.discountLabelEn ?? car.priceUi.discountLabelAr
    : car.priceUi.discountLabelAr;
  const promoActive = isNationalDayPromoActive();

  return (
    <article
      className="group flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md"
    >
      {/* ────── الرأس: الاسم ، الفئة ────── */}
      <div className="flex items-start justify-between gap-2 px-4 pt-4 pb-2">

        {/* الاسم + السنة + أو مشابهة */}
        <div className="min-w-0">
          <h3 className="truncate text-base font-bold leading-snug text-gray-900">
            <bdi>{car.brand}</bdi>{" "}
            <bdi>{car.name}</bdi>
            {car.year ? (
              <span className="mx-1 text-sm font-normal text-gray-400">
                <bdi>{car.year}</bdi>
              </span>
            ) : null}
          </h3>
          <p className="text-[12px] font-medium text-gray-500">{t("orSimilar")}</p>

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
        ) : discountLabel ? (
          promoActive ? (
            <span className="flex shrink-0 flex-col items-center gap-0.5 whitespace-nowrap rounded-xl bg-[#006C35] px-2.5 py-1 leading-none text-white shadow-sm">
              <span className="text-[10.5px] font-extrabold">{NATIONAL_DAY_PROMO_LABEL_AR}</span>
              <span className="text-[8.5px] font-semibold text-emerald-100">
                {NATIONAL_DAY_PROMO_DATE_RANGE_AR}
              </span>
            </span>
          ) : (
            <span className="flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-red-50 px-2.5 py-1 text-[11px] font-bold text-red-600">
              {discountLabel}
            </span>
          )
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
        {car.badge && discountLabel ? (
          promoActive ? (
            <span className="absolute top-4 left-4 flex flex-col items-center gap-0.5 rounded-xl bg-[#006C35] px-2.5 py-1 leading-none text-white shadow-md">
              <span className="text-[10px] font-extrabold">{NATIONAL_DAY_PROMO_LABEL_AR}</span>
              <span className="text-[8px] font-semibold text-emerald-100">
                {NATIONAL_DAY_PROMO_DATE_RANGE_AR}
              </span>
            </span>
          ) : (
            <span className="absolute top-4 left-4 rounded-full bg-red-500 px-2 py-0.5 text-[10px] font-bold text-white">
              {discountLabel}
            </span>
          )
        ) : null}
      </div>

      {/* ────── شريط المواصفات الأفقي ────── */}
      {car.specs.length > 0 ? (
        <div className="mx-4 mt-3 flex items-center justify-center gap-4 border-t border-b border-gray-100 py-2.5">
          {car.specs.map((s, i) => {
            const specKey = SPEC_KEY_MAP[s.icon];
            const specText = specKey ? t(specKey) : "";
            return (
              <div
                key={`${car.id}-spec-${i}`}
                className="flex items-center gap-1"
              >
                {i > 0 && (
                  <span className="mx-2 h-4 w-px bg-gray-200" />
                )}
                <SpecIcon
                  name={s.icon}
                  className="h-4 w-4 shrink-0 text-gray-500"
                />
                <span className="text-[13px] font-bold tabular-nums text-gray-800">
                  {s.value}
                </span>
                <span className="text-[10px] font-medium text-gray-400">
                  {specText}
                </span>
              </div>
            );
          })}
        </div>
      ) : null}

      {/* ────── السعر + زر الحجز في نفس الصف ────── */}
      <div className="flex items-end justify-between gap-3 px-4 pt-3 pb-1">

        {/* السعر */}
        <div className="flex flex-col">
          {primaryLabel && (
            <p className="text-[12px] font-medium text-gray-500">
              {primaryLabel}
            </p>
          )}
          {footnote && (
            <p className="text-[12px] text-gray-400">{footnote}</p>
          )}
          <div className="mt-0.5 flex items-baseline gap-1.5">
            {prefixLabel ? (
              <span className="text-[12px] font-semibold text-gray-500">
                {prefixLabel}
              </span>
            ) : null}
            {car.priceUi.originalPrimaryAmount ? (
              <span className="flex items-baseline gap-0.5 text-sm font-semibold text-gray-400 line-through decoration-red-500 decoration-[1.5px] opacity-85 me-0.5">
                {car.priceUi.originalPrimaryAmount}
                <SarCurrencyGlyph className="h-[0.7em] w-[0.7em]" />
              </span>
            ) : null}
            <span className="text-[26px] font-extrabold leading-none tracking-tight text-gray-900">
              {car.priceUi.primaryAmount}
            </span>
            <SarCurrencyGlyph className="h-4 w-4 shrink-0 text-gray-700" />
            {periodLabel && primaryLabel !== periodLabel ? (
              <span className="text-[12px] font-semibold text-gray-500">
                / {periodLabel}
              </span>
            ) : null}
          </div>
          {car.priceUi.secondaryAmount && (
            <p className="mt-0.5 flex items-baseline gap-1 text-[11px] text-gray-500">
              {car.priceUi.secondaryAmount}
              <SarCurrencyGlyph className="h-[0.65em] w-[0.65em]" />
              {secondaryLabel && (
                <span>· {secondaryLabel}</span>
              )}
            </p>
          )}
        </div>

        {/* زر الحجز */}
        <div className="shrink-0 [&_a]:!w-auto [&_button]:!w-auto">
          <FleetBookNowButton
            modelId={car.modelId}
            cities={cities}
            carName={`${car.brand} ${car.name}`}
            allowHolidayBooking={allowHolidayBooking}
            availableBranchSlugs={car.availableBranchSlugs}
          />
        </div>
      </div>

      {/* ────── حفظ للمرة القادمة ────── */}
      <div className="flex justify-end px-4 pb-3 pt-1">
        <button
          type="button"
          className="flex items-center gap-1 text-[11px] text-gray-400 transition-colors hover:text-gray-600"
        >
        </button>
      </div>
    </article>
  );
}