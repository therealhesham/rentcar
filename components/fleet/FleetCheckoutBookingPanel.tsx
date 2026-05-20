"use client";

import { BookingWidget } from "@/components/home/BookingWidget";
import type { BookingCityBranchesOption } from "@/lib/booking-location-options";
import type { FleetSearchUrlHydrate } from "@/lib/fleet-search-url-hydrate";
import type { BookingWidgetTabFlags } from "@/lib/booking-widget-tabs";

type Props = {
  modelId: number;
  cities: BookingCityBranchesOption[];
  tabFlags?: BookingWidgetTabFlags | null;
  initialFromUrl?: FleetSearchUrlHydrate | null;
};

/** نفس ويدجت الرئيسية — وضع checkout يطبّق التواريخ على `/fleet/checkout`. */
export function FleetCheckoutBookingPanel({
  modelId,
  cities,
  tabFlags,
  initialFromUrl,
}: Props) {
  return (
    <BookingWidget
      cities={cities}
      variant="checkout"
      checkoutModelId={modelId}
      tabFlags={tabFlags}
      initialFromUrl={initialFromUrl}
    />
  );
}
