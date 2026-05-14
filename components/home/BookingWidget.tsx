import { BookingSearchWidget } from "@/components/home/BookingSearchWidget";
import type { BookingCityBranchesOption } from "@/lib/booking-location-options";
import type { BookingWidgetTabFlags } from "@/lib/booking-widget-tabs";
import type { FleetSearchUrlHydrate } from "@/lib/fleet-search-url-hydrate";

export type { BookingBranchOption, BookingCityBranchesOption } from "@/lib/booking-location-options";

export function BookingWidget({
  cities,
  initialFromUrl,
  tabFlags,
}: {
  cities: BookingCityBranchesOption[];
  /** من معاملات `/fleet` — تعبئة النموذج عند فتح الصفحة */
  initialFromUrl?: FleetSearchUrlHydrate | null;
  /** من الإدارة — تبويبات مخفية دون إشعار للزائر */
  tabFlags?: BookingWidgetTabFlags | null;
}) {
  return (
    <BookingSearchWidget cities={cities} initialFromUrl={initialFromUrl} tabFlags={tabFlags} />
  );
}
