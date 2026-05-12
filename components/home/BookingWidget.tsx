import { BookingSearchWidget } from "@/components/home/BookingSearchWidget";
import type { BookingCityBranchesOption } from "@/lib/booking-location-options";

export type { BookingBranchOption, BookingCityBranchesOption } from "@/lib/booking-location-options";

export function BookingWidget({ cities }: { cities: BookingCityBranchesOption[] }) {
  return <BookingSearchWidget cities={cities} />;
}
