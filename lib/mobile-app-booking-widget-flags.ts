/**
 * تفعيل/تعطيل تابات ووضع الاستلام في ودجت البحث بالشاشة الرئيسية لتطبيق
 * الموبايل "روائس". يُخزَّن في MobileAppSetting بمفتاح
 * `mobile_app_booking_widget_tabs_v1` كـ JSON — مستقل تماماً عن
 * booking_widget_tabs الخاص بالموقع.
 */

export const MOBILE_APP_BOOKING_WIDGET_PERIODS = [
  "rentalDaily",
  "rentalWeekly",
  "rentalMonthly",
  "rentalMonthlyPackages",
] as const;

export type MobileAppBookingWidgetPeriod = (typeof MOBILE_APP_BOOKING_WIDGET_PERIODS)[number];

export const MOBILE_APP_BOOKING_WIDGET_MODES = ["modePickup", "modeDelivery"] as const;

export type MobileAppBookingWidgetMode = (typeof MOBILE_APP_BOOKING_WIDGET_MODES)[number];

export type MobileAppBookingWidgetFlags = Record<
  MobileAppBookingWidgetPeriod | MobileAppBookingWidgetMode,
  boolean
>;

export const MOBILE_KEY_BOOKING_WIDGET_TABS = "mobile_app_booking_widget_tabs_v1";

export const DEFAULT_MOBILE_APP_BOOKING_WIDGET_FLAGS: MobileAppBookingWidgetFlags = {
  rentalDaily: true,
  rentalWeekly: true,
  rentalMonthly: true,
  rentalMonthlyPackages: true,
  modePickup: true,
  modeDelivery: true,
};

function asBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return fallback;
}

export function normalizeMobileAppBookingWidgetFlags(raw: unknown): MobileAppBookingWidgetFlags {
  const o =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  let flags: MobileAppBookingWidgetFlags = {
    rentalDaily: asBool(o.rentalDaily, DEFAULT_MOBILE_APP_BOOKING_WIDGET_FLAGS.rentalDaily),
    rentalWeekly: asBool(o.rentalWeekly, DEFAULT_MOBILE_APP_BOOKING_WIDGET_FLAGS.rentalWeekly),
    rentalMonthly: asBool(o.rentalMonthly, DEFAULT_MOBILE_APP_BOOKING_WIDGET_FLAGS.rentalMonthly),
    rentalMonthlyPackages: asBool(
      o.rentalMonthlyPackages,
      DEFAULT_MOBILE_APP_BOOKING_WIDGET_FLAGS.rentalMonthlyPackages,
    ),
    modePickup: asBool(o.modePickup, DEFAULT_MOBILE_APP_BOOKING_WIDGET_FLAGS.modePickup),
    modeDelivery: asBool(o.modeDelivery, DEFAULT_MOBILE_APP_BOOKING_WIDGET_FLAGS.modeDelivery),
  };

  const anyPeriod = MOBILE_APP_BOOKING_WIDGET_PERIODS.some((p) => flags[p]);
  if (!anyPeriod) {
    flags = { ...flags, rentalDaily: true };
  }

  const anyMode = MOBILE_APP_BOOKING_WIDGET_MODES.some((m) => flags[m]);
  if (!anyMode) {
    flags = { ...flags, modePickup: true };
  }

  return flags;
}
