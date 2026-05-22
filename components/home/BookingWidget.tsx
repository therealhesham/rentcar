import {
  BookingSearchWidget,
  type BookingSearchWidgetVariant,
} from "@/components/home/BookingSearchWidget";
import type { BookingCityBranchesOption } from "@/lib/booking-location-options";
import type { BookingWidgetTabFlags } from "@/lib/booking-widget-tabs";
import type { FleetSearchUrlHydrate } from "@/lib/fleet-search-url-hydrate";

export type { BookingBranchOption, BookingCityBranchesOption } from "@/lib/booking-location-options";

export type BookingWidgetVariant = BookingSearchWidgetVariant;

export function BookingWidget({
  cities,
  initialFromUrl,
  tabFlags,
  variant = "search",
  checkoutModelId,
  combinedPanel = false,
}: {
  cities: BookingCityBranchesOption[];
  /** من معاملات `/fleet` — تعبئة النموذج عند فتح الصفحة */
  initialFromUrl?: FleetSearchUrlHydrate | null;
  /** من الإدارة — تبويبات مخفية دون إشعار للزائر */
  tabFlags?: BookingWidgetTabFlags | null;
  /** search = بحث الأسطول (الرئيسية والأسطول) · checkout = تطبيق على حجز سيارة محددة */
  variant?: BookingWidgetVariant;
  checkoutModelId?: number;
  /** داخل بطاقة موحّدة مع فلاتر الأسطول — بدون ظل/حواف خارجية */
  combinedPanel?: boolean;
}) {
  return (
    <BookingSearchWidget
      cities={cities}
      initialFromUrl={initialFromUrl}
      tabFlags={tabFlags}
      variant={variant}
      checkoutModelId={checkoutModelId}
      combinedPanel={combinedPanel}
    />
  );
}
