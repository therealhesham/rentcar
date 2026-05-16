"use client";

import { ChevronDown } from "lucide-react";
import type { BookingBranchOption, BookingCityBranchesOption } from "@/lib/booking-location-options";

const CITY_BRANCH_LBL =
  "shrink-0 self-center text-[10px] font-bold uppercase tracking-wide text-[#003749]/55";

type CityBranchSelectsProps = {
  dateCities: BookingCityBranchesOption[];
  citySlug: string;
  branchSlug: string;
  branchOptions: BookingBranchOption[];
  defaultBranchSlug: string;
  branchSelectRequired: boolean;
  cityInputId: string;
  branchInputId: string;
  onCityChange: (slug: string) => void;
  onBranchChange: (slug: string) => void;
  selectClassName?: string;
};

function CityBranchSelects({
  dateCities,
  citySlug,
  branchSlug,
  branchOptions,
  defaultBranchSlug,
  branchSelectRequired,
  cityInputId,
  branchInputId,
  onCityChange,
  onBranchChange,
  selectClassName = "w-full min-w-0 cursor-pointer appearance-none rounded-lg border border-[#ebe4d3]/70 bg-white/70 py-2 pe-8 ps-2.5 text-[13px] font-semibold text-[#0f1923] outline-none transition-[border-color,box-shadow,background-color] hover:bg-white focus-visible:border-[#dbb878] focus-visible:ring-2 focus-visible:ring-[#dbb878]/25",
}: CityBranchSelectsProps) {
  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-2">
      <label htmlFor={cityInputId} className={CITY_BRANCH_LBL}>
        المدينة
      </label>
      <div className="relative min-w-0">
        <select
          id={cityInputId}
          value={citySlug}
          onChange={(ev) => onCityChange(ev.target.value)}
          required={branchSelectRequired}
          className={selectClassName}
        >
          {dateCities.map((c) => (
            <option key={c.slug} value={c.slug}>
              {c.name}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute end-2 top-1/2 size-3.5 -translate-y-1/2 text-[#8a8274]"
          aria-hidden
        />
      </div>
      <label htmlFor={branchInputId} className={CITY_BRANCH_LBL}>
        الفرع
      </label>
      <div className="relative min-w-0">
        <select
          id={branchInputId}
          value={branchSlug || defaultBranchSlug}
          onChange={(ev) => onBranchChange(ev.target.value)}
          required={branchSelectRequired}
          disabled={branchOptions.length === 0}
          className={`${selectClassName} disabled:cursor-not-allowed disabled:opacity-45`}
        >
          {branchOptions.map((b) => (
            <option key={b.slug} value={b.slug}>
              {b.name}
            </option>
          ))}
        </select>
        <ChevronDown
          className="pointer-events-none absolute end-2 top-1/2 size-3.5 -translate-y-1/2 text-[#8a8274]"
          aria-hidden
        />
      </div>
    </div>
  );
}

export type PickupReturnBranchFieldsProps = {
  uidPrefix: string;
  dateCities: BookingCityBranchesOption[];
  defaultCitySlug: string;
  branchSelectRequired: boolean;
  pickupCity: string;
  pickupBranch: string;
  pickupCityBranches: BookingBranchOption[];
  defaultPickupBranchSlug: string;
  returnCity: string;
  returnBranch: string;
  returnCityBranches: BookingBranchOption[];
  defaultReturnBranchSlug: string;
  returnLocationDifferent: boolean;
  onReturnLocationDifferentChange: (checked: boolean) => void;
  onPickupCityChange: (slug: string) => void;
  onPickupBranchChange: (slug: string) => void;
  onReturnCityChange: (slug: string) => void;
  onReturnBranchChange: (slug: string) => void;
  dense?: boolean;
  /** عند التضمين داخل FieldCard يُخفى عنوان «موقع الاستلام» */
  hidePickupTitle?: boolean;
};

export function PickupReturnBranchFields({
  uidPrefix,
  dateCities,
  defaultCitySlug,
  branchSelectRequired,
  pickupCity,
  pickupBranch,
  pickupCityBranches,
  defaultPickupBranchSlug,
  returnCity,
  returnBranch,
  returnCityBranches,
  defaultReturnBranchSlug,
  returnLocationDifferent,
  onReturnLocationDifferentChange,
  onPickupCityChange,
  onPickupBranchChange,
  onReturnCityChange,
  onReturnBranchChange,
  dense = false,
  hidePickupTitle = false,
}: PickupReturnBranchFieldsProps) {
  const checkboxId = `${uidPrefix}-return-diff`;
  const pickupTitleClass = dense
    ? "mb-1.5 text-[10px] font-black uppercase tracking-wide text-[#003749]/45"
    : "mb-1.5 text-[10px] font-black uppercase tracking-wide text-[#003749]/55";
  const returnBoxClass = dense
    ? "rounded-xl border border-[#ebe4d3]/60 bg-white/50 p-3"
    : "rounded-lg border border-[#ebe4d3]/70 bg-white/40 p-2.5";
  const selectClass = dense
    ? "w-full cursor-pointer appearance-none rounded-lg border border-[#ebe4d3]/70 bg-white/80 py-2 pe-8 ps-2.5 text-[14px] font-semibold text-[#0f1923] outline-none transition-[border-color,box-shadow] focus-visible:border-[#dbb878] focus-visible:ring-2 focus-visible:ring-[#dbb878]/25 disabled:cursor-not-allowed disabled:opacity-50"
    : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div>
        {!hidePickupTitle ? (
          <p className={pickupTitleClass}>موقع الاستلام</p>
        ) : null}
        <CityBranchSelects
          dateCities={dateCities}
          citySlug={pickupCity || defaultCitySlug}
          branchSlug={pickupBranch || defaultPickupBranchSlug}
          branchOptions={pickupCityBranches}
          defaultBranchSlug={defaultPickupBranchSlug}
          branchSelectRequired={branchSelectRequired}
          cityInputId={`${uidPrefix}-pickup-city`}
          branchInputId={`${uidPrefix}-pickup-branch`}
          onCityChange={onPickupCityChange}
          onBranchChange={onPickupBranchChange}
          selectClassName={selectClass}
        />
      </div>

      <label
        htmlFor={checkboxId}
        className="flex cursor-pointer items-center gap-2 text-[12px] font-semibold text-[#0f1923]/85"
      >
        <input
          id={checkboxId}
          type="checkbox"
          checked={returnLocationDifferent}
          onChange={(ev) => onReturnLocationDifferentChange(ev.target.checked)}
          className="size-4 shrink-0 cursor-pointer rounded border-[#c9a356]/60 text-[#dbb878] focus-visible:ring-2 focus-visible:ring-[#dbb878]/35"
        />
        موقع الإرجاع مختلف
      </label>

      {returnLocationDifferent ? (
        <div className={returnBoxClass}>
          <p className={pickupTitleClass}>موقع الإرجاع</p>
          <CityBranchSelects
            dateCities={dateCities}
            citySlug={returnCity || defaultCitySlug}
            branchSlug={returnBranch || defaultReturnBranchSlug}
            branchOptions={returnCityBranches}
            defaultBranchSlug={defaultReturnBranchSlug}
            branchSelectRequired={branchSelectRequired}
            cityInputId={`${uidPrefix}-return-city`}
            branchInputId={`${uidPrefix}-return-branch`}
            onCityChange={onReturnCityChange}
            onBranchChange={onReturnBranchChange}
            selectClassName={selectClass}
          />
        </div>
      ) : null}
    </div>
  );
}
