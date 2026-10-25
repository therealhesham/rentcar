/**
 * تفعيل/تعطيل زرار "إلغاء الحجز" في شاشة تفاصيل الحجز بتطبيق الموبايل
 * "روائس". يُخزَّن في MobileAppSetting بمفتاح
 * `mobile_app_booking_cancel_button_v1` كـ JSON — لا يمنع الإلغاء من لوحة
 * الإدارة، فقط يُخفي زرار الإلغاء الذاتي من التطبيق.
 */

export const MOBILE_KEY_BOOKING_CANCEL_BUTTON = "mobile_app_booking_cancel_button_v1";

export type MobileAppBookingCancelFlag = {
  enabled: boolean;
};

export const DEFAULT_MOBILE_APP_BOOKING_CANCEL_FLAG: MobileAppBookingCancelFlag = {
  enabled: true,
};

function asBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return fallback;
}

export function normalizeMobileAppBookingCancelFlag(raw: unknown): MobileAppBookingCancelFlag {
  const o =
    raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  return { enabled: asBool(o.enabled, DEFAULT_MOBILE_APP_BOOKING_CANCEL_FLAG.enabled) };
}
