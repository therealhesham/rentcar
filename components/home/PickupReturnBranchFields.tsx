"use client";

import { ChevronDown } from "lucide-react";
import type { BookingCityBranchesOption } from "@/lib/booking-location-options";

const DEFAULT_SELECT_CLASS =
  "w-full min-w-0 cursor-pointer appearance-none rounded-lg border border-[#ebe4d3]/70 bg-white/70 py-2 pe-8 ps-2.5 text-[13px] font-semibold text-[#0f1923] outline-none transition-[border-color,box-shadow,background-color] duration-200 hover:bg-white focus-visible:border-[#dbb878] focus-visible:ring-2 focus-visible:ring-[#dbb878]/25 disabled:cursor-not-allowed disabled:opacity-45";

const DEFAULT_LABEL_CLASS =
  "shrink-0 self-center text-[10px] font-bold uppercase tracking-wide text-[#003749]/55";

export type CityBranchSelectPairProps = {
  cityId: string;
  branchId: string;
  dateCities: BookingCityBranchesOption[];
  citySlug: string;
  branchSlug: string;
  defaultCitySlug: string;
  defaultBranchSlug: string;
  branchSelectRequired: boolean;
  onCityChange: (slug: string) => void;
  onBranchChange: (slug: string) => void;
  dense?: boolean;
  selectClassName?: string;
  labelClassName?: string;
};

/** مدينة ثم فرع — نفس أسلوب العرض السابق في الـ widget. */
export function CityBranchSelectPair({
  cityId,
  branchId,
  dateCities,
  citySlug,
  branchSlug,
  defaultCitySlug,
  defaultBranchSlug,
  branchSelectRequired,
  onCityChange,
  onBranchChange,
  dense = false,
  selectClassName,
  labelClassName,
}: CityBranchSelectPairProps) {
  const sel = selectClassName ?? DEFAULT_SELECT_CLASS;
  const lab = labelClassName ?? DEFAULT_LABEL_CLASS;
  const hasAnyBranches = dateCities.some((c) => c.branches.length > 0);
  const cityVal = citySlug || defaultCitySlug;
  const branches = dateCities.find((c) => c.slug === cityVal)?.branches ?? [];
  const rawBranch = branchSlug || defaultBranchSlug;
  const branchVal = branches.some((b) => b.slug === rawBranch)
    ? rawBranch
    : (branches[0]?.slug ?? "");

  const citySelect = (
    <div className="relative min-w-0">
      <select
        id={cityId}
        value={cityVal}
        onChange={(ev) => onCityChange(ev.target.value)}
        required={branchSelectRequired}
        disabled={!hasAnyBranches}
        className={sel}
      >
        {dateCities.map((city) =>
          city.branches.length > 0 ? (
            <option key={city.slug} value={city.slug}>
              {city.name}
            </option>
          ) : null,
        )}
      </select>
      <ChevronDown
        className="pointer-events-none absolute end-2 top-1/2 size-3.5 -translate-y-1/2 text-[#8a8274]"
        aria-hidden
      />
    </div>
  );

  const branchSelect = (
    <div className="relative min-w-0">
      <select
        id={branchId}
        value={branchVal}
        onChange={(ev) => onBranchChange(ev.target.value)}
        required={branchSelectRequired}
        disabled={!hasAnyBranches || branches.length === 0}
        className={sel}
      >
        {branches.map((branch) => (
          <option key={branch.slug} value={branch.slug}>
            {branch.name}
          </option>
        ))}
      </select>
      <ChevronDown
        className="pointer-events-none absolute end-2 top-1/2 size-3.5 -translate-y-1/2 text-[#8a8274]"
        aria-hidden
      />
    </div>
  );

  if (dense) {
    return (
      <div className="flex flex-col gap-2">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-2">
          <label htmlFor={cityId} className={lab}>
            المدينة
          </label>
          {citySelect}
        </div>
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-2">
          <label htmlFor={branchId} className={lab}>
            الفرع
          </label>
          {branchSelect}
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2 sm:gap-x-4">
      <div className="flex min-w-0 flex-col gap-1">
        <label htmlFor={cityId} className={lab}>
          المدينة
        </label>
        {citySelect}
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <label htmlFor={branchId} className={lab}>
          الفرع
        </label>
        {branchSelect}
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
  defaultPickupBranchSlug: string;
  returnCity: string;
  returnBranch: string;
  defaultReturnBranchSlug: string;
  returnLocationDifferent: boolean;
  onReturnLocationDifferentChange: (checked: boolean) => void;
  onPickupCityChange: (slug: string) => void;
  onPickupBranchChange: (slug: string) => void;
  onReturnCityChange: (slug: string) => void;
  onReturnBranchChange: (slug: string) => void;
  dense?: boolean;
  hidePickupTitle?: boolean;
};

export function PickupReturnBranchFields({
  uidPrefix,
  dateCities,
  defaultCitySlug,
  branchSelectRequired,
  pickupCity,
  pickupBranch,
  defaultPickupBranchSlug,
  returnCity,
  returnBranch,
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
    ? "w-full min-w-0 cursor-pointer appearance-none rounded-lg border border-[#ebe4d3]/70 bg-white/80 py-2 pe-8 ps-2.5 text-[14px] font-semibold text-[#0f1923] outline-none transition-[border-color,box-shadow] focus-visible:border-[#dbb878] focus-visible:ring-2 focus-visible:ring-[#dbb878]/25 disabled:cursor-not-allowed disabled:opacity-50"
    : undefined;
  const labelClass = dense
    ? "shrink-0 self-center text-[10px] font-bold uppercase tracking-wide text-[#003749]/45"
    : undefined;

  return (
    <div className="flex flex-col gap-3">
      <div>
        {!hidePickupTitle ? (
          <p className={pickupTitleClass}>موقع الاستلام</p>
        ) : null}
        <CityBranchSelectPair
          cityId={`${uidPrefix}-pickup-city`}
          branchId={`${uidPrefix}-pickup-branch`}
          dateCities={dateCities}
          citySlug={pickupCity}
          branchSlug={pickupBranch}
          defaultCitySlug={defaultCitySlug}
          defaultBranchSlug={defaultPickupBranchSlug}
          branchSelectRequired={branchSelectRequired}
          onCityChange={onPickupCityChange}
          onBranchChange={onPickupBranchChange}
          dense={dense}
          selectClassName={selectClass}
          labelClassName={labelClass}
        />
      </div>

      <label
        htmlFor={checkboxId}
        className="-mx-1 flex cursor-pointer items-center gap-2.5 rounded-lg border border-transparent px-2 py-2 text-[12px] font-semibold text-[#0f1923]/85 transition-colors hover:border-[#ebe4d3]/90 hover:bg-white/50"
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
          <CityBranchSelectPair
            cityId={`${uidPrefix}-return-city`}
            branchId={`${uidPrefix}-return-branch`}
            dateCities={dateCities}
            citySlug={returnCity}
            branchSlug={returnBranch}
            defaultCitySlug={defaultCitySlug}
            defaultBranchSlug={defaultReturnBranchSlug}
            branchSelectRequired={branchSelectRequired}
            onCityChange={onReturnCityChange}
            onBranchChange={onReturnBranchChange}
            dense={dense}
            selectClassName={selectClass}
            labelClassName={labelClass}
          />
        </div>
      ) : null}
    </div>
  );
}
