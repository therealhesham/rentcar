/**
 * تفعيل/تعطيل تبويبات ويدجت الحجز (الرئيسية والأسطول).
 * يُخزَّن في SiteSetting كـ JSON — القيم الافتراضية كلها مفعّلة.
 */
export type BookingWidgetTabFlags = {
  rentalDaily: boolean;
  rentalWeekly: boolean;
  rentalMonthly: boolean;
  rentalMonthlyPackages: boolean;
  rentalCorporate: boolean;
  modePickup: boolean;
  modeDelivery: boolean;
  /** السماح بالحجز في أيام إجازات الفروع (الافتراضي: false = عدم السماح، أي تعطيل الأيام في التقويم) */
  allowHolidayBooking: boolean;
  /** السماح بالحجز عند اكتمال العدد بدون تقييد بالمخزون والتداخلات (الافتراضي: false = تقييد محكم بالمخزون) */
  allowOverbooking: boolean;
};

export const DEFAULT_BOOKING_WIDGET_TAB_FLAGS: BookingWidgetTabFlags = {
  rentalDaily: true,
  rentalWeekly: true,
  rentalMonthly: true,
  rentalMonthlyPackages: true,
  rentalCorporate: true,
  modePickup: true,
  modeDelivery: true,
  allowHolidayBooking: false,
  allowOverbooking: false,
};

function asBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return fallback;
}

/** يضمن وجود خيار إيجار واحد على الأقل، ووجود وضع استلام عند الحاجة */
export function normalizeBookingWidgetTabFlags(raw: unknown): BookingWidgetTabFlags {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  let flags: BookingWidgetTabFlags = {
    rentalDaily: asBool(o.rentalDaily, DEFAULT_BOOKING_WIDGET_TAB_FLAGS.rentalDaily),
    rentalWeekly: asBool(o.rentalWeekly, DEFAULT_BOOKING_WIDGET_TAB_FLAGS.rentalWeekly),
    rentalMonthly: asBool(o.rentalMonthly, DEFAULT_BOOKING_WIDGET_TAB_FLAGS.rentalMonthly),
    rentalMonthlyPackages: asBool(
      o.rentalMonthlyPackages,
      DEFAULT_BOOKING_WIDGET_TAB_FLAGS.rentalMonthlyPackages,
    ),
    rentalCorporate: asBool(o.rentalCorporate, DEFAULT_BOOKING_WIDGET_TAB_FLAGS.rentalCorporate),
    modePickup: asBool(o.modePickup, DEFAULT_BOOKING_WIDGET_TAB_FLAGS.modePickup),
    modeDelivery: asBool(o.modeDelivery, DEFAULT_BOOKING_WIDGET_TAB_FLAGS.modeDelivery),
    allowHolidayBooking: asBool(
      o.allowHolidayBooking,
      DEFAULT_BOOKING_WIDGET_TAB_FLAGS.allowHolidayBooking,
    ),
    allowOverbooking: asBool(
      o.allowOverbooking,
      DEFAULT_BOOKING_WIDGET_TAB_FLAGS.allowOverbooking,
    ),
  };

  const anyRental =
    flags.rentalDaily ||
    flags.rentalWeekly ||
    flags.rentalMonthly ||
    flags.rentalMonthlyPackages ||
    flags.rentalCorporate;
  if (!anyRental) {
    flags = { ...flags, rentalDaily: true };
  }

  const needsPickupMode =
    flags.rentalDaily ||
    flags.rentalWeekly ||
    flags.rentalMonthly ||
    flags.rentalMonthlyPackages;
  if (needsPickupMode && !flags.modePickup && !flags.modeDelivery) {
    flags = { ...flags, modePickup: true };
  }

  return flags;
}
