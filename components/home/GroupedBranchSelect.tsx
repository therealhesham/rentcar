"use client";

import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import type { BookingCityBranchesOption } from "@/lib/booking-location-options";
import { citySlugForBranchSlug } from "@/lib/fleet-search-url-hydrate";

const DEFAULT_SELECT_CLASS =
  "w-full min-w-0 cursor-pointer appearance-none rounded-lg border border-[#ebe4d3]/70 bg-white/70 py-2 pe-8 ps-2.5 text-[13px] font-semibold text-[#0f1923] outline-none transition-[border-color,box-shadow,background-color] hover:bg-white focus-visible:border-[#dbb878] focus-visible:ring-2 focus-visible:ring-[#dbb878]/25 disabled:cursor-not-allowed disabled:opacity-45";

type Props = {
  id: string;
  dateCities: ReadonlyArray<BookingCityBranchesOption>;
  branchSlug: string;
  defaultBranchSlug?: string;
  required?: boolean;
  disabled?: boolean;
  label?: string;
  labelClassName?: string;
  selectClassName?: string;
  onBranchSelect: (branchSlug: string, citySlug: string | null) => void;
};

/** قائمة فرع واحدة: مدينة كمجموعة وفروعها كخيارات فرعية. */
export function GroupedBranchSelect({
  id,
  dateCities,
  branchSlug,
  defaultBranchSlug = "",
  required = false,
  disabled = false,
  label = "الفرع",
  labelClassName = "shrink-0 self-center text-[10px] font-bold uppercase tracking-wide text-[#003749]/55",
  selectClassName = DEFAULT_SELECT_CLASS,
  onBranchSelect,
}: Props) {
  const t = useTranslations("ReservationForm");
  const value = branchSlug || defaultBranchSlug;
  const hasBranches = dateCities.some((c) => c.branches.length > 0);

  function handleChange(nextBranch: string) {
    if (!nextBranch) {
      onBranchSelect("", null);
      return;
    }
    const city = citySlugForBranchSlug(dateCities, nextBranch);
    onBranchSelect(nextBranch, city);
  }

  return (
    <div className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-2 gap-y-2">
      <label htmlFor={id} className={labelClassName}>
        {label}
      </label>
      <div className="relative min-w-0">
        <select
          id={id}
          value={value}
          onChange={(ev) => handleChange(ev.target.value)}
          required={required}
          disabled={disabled || !hasBranches}
          className={selectClassName}
        >
          <option value="">{t("selectBranch")}</option>
          {dateCities.map((city) =>
            city.branches.length > 0 ? (
              <optgroup key={city.slug} label={city.name}>
                {city.branches.map((branch) => (
                  <option key={branch.slug} value={branch.slug}>
                    {branch.name}
                  </option>
                ))}
              </optgroup>
            ) : null,
          )}
        </select>
        <ChevronDown
          className="pointer-events-none absolute end-2 top-1/2 size-3.5 -translate-y-1/2 text-[#8a8274]"
          aria-hidden
        />
      </div>
    </div>
  );
}
