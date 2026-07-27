"use client";

import { useLocale, useTranslations } from "next-intl";
import { SpecIcon } from "@/components/icons";
import { FleetBookNowButton } from "@/components/fleet/FleetBookNowButton";
import type { FleetCar } from "@/lib/fleet-types";
import type { BookingCityBranchesOption } from "@/lib/booking-location-options";
import { SarCurrencyGlyph } from "@/components/ui/SarCurrencyGlyph";

const SPEC_KEY_MAP: Record<string, string> = {
  airline_seat_recline_extra: "seats",
  door_open: "doors",
  luggage: "bags",
  mode_fan: "ac",
  bolt: "electric",
  speed: "speed",
  timer: "time",
};

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
  const ribbonText = car.badge || discountLabel;

  return (
    <article className="group relative flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-md">
      {/* ────── شارة الفئة (ربطة أعلى الزاوية) ────── */}
      {ribbonText ? (
        <span className="absolute top-0 end-0 z-10 rounded-bl-2xl bg-[#e6be82] px-3.5 py-1.5 text-[12px] font-bold text-[#003749] shadow-sm">
          {ribbonText}
        </span>
      ) : null}

      {/* ────── صورة السيارة ────── */}
      <div className="relative flex h-44 w-full items-center justify-center overflow-hidden bg-white px-4 pt-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={car.image}
          alt={car.alt}
          loading="lazy"
          className="h-full w-full object-contain transition-transform duration-700 ease-out group-hover:scale-[1.04]"
        />
      </div>

      {/* ────── الموديل والسنة ────── */}
      <div className="flex items-center justify-between gap-2 border-t border-gray-100 px-4 py-3">
        <span className="truncate text-[15px] font-extrabold text-[#003749]">
          {car.name}
          {car.brand ? <span className="font-bold text-gray-400"> | {car.brand}</span> : null}
        </span>
        {car.year ? (
          <span className="shrink-0 text-[17px] font-bold text-gray-800">{car.year}</span>
        ) : null}
      </div>

      {/* ────── المواصفات (يمين) + السعر (يسار) في صف واحد ────── */}
      <div className="flex items-center justify-between gap-3 border-t border-gray-100 px-4 py-3">
        {/* dir="ltr": ترتيب الأيقونات ثابت بصرياً (أبواب، مقاعد، حقائب) مهما كان اتجاه اللغة */}
        {car.specs.length > 0 ? (
          <div dir="ltr" className="flex items-center gap-5">
            {car.specs.map((s, i) => {
              const specKey = SPEC_KEY_MAP[s.icon];
              const specText = specKey ? t(specKey) : "";
              return (
                <div key={`${car.id}-spec-${i}`} className="flex flex-col items-center gap-1">
                  <SpecIcon name={s.icon} className="h-5 w-5 shrink-0 text-[#b9a17a]" />
                  <span className="text-sm font-bold tabular-nums text-gray-800">{s.value}</span>
                  <span className="sr-only">{specText}</span>
                </div>
              );
            })}
          </div>
        ) : (
          <span />
        )}

        {/* السعر — الرقم ثم رمز الريال (الرمز يقع يسار الرقم في الاتجاه العربي) */}
        <div className="flex shrink-0 flex-col items-end">
          {prefixLabel ? (
            <span className="text-[11px] font-semibold text-gray-500">{prefixLabel}</span>
          ) : null}
          <div className="flex items-baseline gap-1.5">
            <span className="text-[26px] font-extrabold leading-none tracking-tight text-[#003749]">
              {car.priceUi.primaryAmount}
            </span>
            <SarCurrencyGlyph className="h-4 w-4 shrink-0 text-[#003749]" />
          </div>
          {periodLabel && primaryLabel !== periodLabel ? (
            <span className="mt-0.5 text-[11px] font-semibold text-gray-500">
              / {periodLabel}
            </span>
          ) : primaryLabel ? (
            <span className="mt-0.5 text-[11px] font-medium text-gray-500">{primaryLabel}</span>
          ) : null}

          {/* السعر بعد الضريبة — يظهر في وضع العرض المزدوج (SPLIT) فقط */}
          {car.priceUi.secondaryAmount ? (
            <span className="mt-1 flex items-baseline gap-1 text-[11px] font-medium text-gray-500">
              {car.priceUi.secondaryAmount}
              <SarCurrencyGlyph className="h-[0.7em] w-[0.7em]" />
              {secondaryLabel ? <span>· {secondaryLabel}</span> : null}
            </span>
          ) : null}
        </div>
      </div>

      {/* ────── زر الحجز + ملاحظة الضريبة ────── */}
      <div className="flex flex-col items-end px-4 pb-4 pt-3">
        <FleetBookNowButton
          modelId={car.modelId}
          cities={cities}
          carName={`${car.brand} ${car.name}`}
          allowHolidayBooking={allowHolidayBooking}
          availableBranchSlugs={car.availableBranchSlugs}
        />
        {footnote ? (
          <p className="mt-2 text-[11px] font-medium text-[#b9975b]">{footnote}</p>
        ) : null}
      </div>
    </article>
  );
}
