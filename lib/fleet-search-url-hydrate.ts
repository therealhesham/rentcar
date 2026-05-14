import type { BookingCityBranchesOption } from "@/lib/booking-location-options";

/** قيم مأخوذة من `/fleet?...` لتعبئة نموذج البحث */
export type FleetSearchUrlHydrate = {
  pickup?: string;
  dropoff?: string;
  rental?: string;
  mode?: string;
  pickupBranch?: string;
  returnBranch?: string;
  dlat?: string;
  dlng?: string;
  daddr?: string;
  pickupCity?: string;
};

function first(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  const s = Array.isArray(v) ? v[0] : v;
  const t = typeof s === "string" ? s.trim() : "";
  return t || undefined;
}

/** يبنى كائن التهيئة إن وُجدت أي معاملات بحث أسطول */
export function buildFleetSearchUrlHydrate(
  params: Record<string, string | string[] | undefined>,
): FleetSearchUrlHydrate | null {
  const pickup = first(params.pickup);
  const dropoff = first(params.dropoff);
  const rental = first(params.rental);
  const mode = first(params.mode);
  const pickupBranch = first(params.pickupBranch);
  const returnBranch = first(params.returnBranch);
  const dlat = first(params.dlat);
  const dlng = first(params.dlng);
  const daddr = first(params.daddr);
  const pickupCity = first(params.pickupCity);

  if (
    !pickup &&
    !dropoff &&
    !rental &&
    !mode &&
    !pickupBranch &&
    !returnBranch &&
    !dlat &&
    !dlng &&
    !daddr &&
    !pickupCity
  ) {
    return null;
  }

  return {
    pickup,
    dropoff,
    rental,
    mode,
    pickupBranch,
    returnBranch,
    dlat,
    dlng,
    daddr,
    pickupCity,
  };
}

export function citySlugForBranchSlug(
  dateCities: BookingCityBranchesOption[],
  branchSlug: string,
): string | null {
  for (const c of dateCities) {
    if (c.branches.some((b) => b.slug === branchSlug)) return c.slug;
  }
  return null;
}
