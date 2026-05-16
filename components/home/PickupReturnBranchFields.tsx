"use client";

import { GroupedBranchSelect } from "@/components/home/GroupedBranchSelect";
import type { BookingCityBranchesOption } from "@/lib/booking-location-options";

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
  pickupBranch,
  defaultPickupBranchSlug,
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
        <GroupedBranchSelect
          id={`${uidPrefix}-pickup-branch`}
          dateCities={dateCities}
          branchSlug={pickupBranch || defaultPickupBranchSlug}
          defaultBranchSlug={defaultPickupBranchSlug}
          required={branchSelectRequired}
          selectClassName={selectClass}
          labelClassName={labelClass}
          onBranchSelect={(branch, city) => {
            if (city) onPickupCityChange(city);
            onPickupBranchChange(branch);
          }}
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
          <GroupedBranchSelect
            id={`${uidPrefix}-return-branch`}
            dateCities={dateCities}
            branchSlug={returnBranch || defaultReturnBranchSlug}
            defaultBranchSlug={defaultReturnBranchSlug}
            required={branchSelectRequired}
            selectClassName={selectClass}
            labelClassName={labelClass}
            onBranchSelect={(branch, city) => {
              if (city) onReturnCityChange(city);
              onReturnBranchChange(branch);
            }}
          />
        </div>
      ) : null}
    </div>
  );
}
