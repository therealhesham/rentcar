import type { BookingCityBranchesOption } from "@/lib/booking-location-options";
import type { BranchOpeningHoursSchedule } from "@/lib/branch-opening-hours";

export function lookupBranchOpeningSchedule(
  cities: BookingCityBranchesOption[],
  branchSlug: string,
): BranchOpeningHoursSchedule | null {
  const s = branchSlug.trim().toLowerCase();
  for (const c of cities) {
    const b = c.branches.find((x) => x.slug === s);
    if (b) return b.openingHours ?? null;
  }
  return null;
}
