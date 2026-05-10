import {
  BookingSearchWidget,
  type BookingBranchOption,
} from "@/components/home/BookingSearchWidget";

export type { BookingBranchOption };

export function BookingWidget({ branches }: { branches: BookingBranchOption[] }) {
  return <BookingSearchWidget branches={branches} />;
}
