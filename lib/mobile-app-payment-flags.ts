/**
 * تفعيل/تعطيل طرق الدفع في تطبيق الموبايل "روائس".
 * يُخزَّن في MobileAppSetting بمفتاح `mobile_app_payment_methods_v1` كـ JSON.
 * مستقل تماماً عن checkout_payment_methods_v1 (SiteSetting) الخاص بالموقع.
 */

export const MOBILE_APP_PAYMENT_METHODS = [
  "TABBY",
  "TAMARA",
  "CARD",
  "MADA",
  "AMKAN",
  "CASH",
  "APPLE_PAY",
  "POINTS",
] as const;

export type MobileAppPaymentMethod = (typeof MOBILE_APP_PAYMENT_METHODS)[number];

export type MobileAppPaymentMethodFlags = Record<MobileAppPaymentMethod, boolean>;

export const MOBILE_KEY_PAYMENT_METHODS = "mobile_app_payment_methods_v1";

export const DEFAULT_MOBILE_APP_PAYMENT_METHOD_FLAGS: MobileAppPaymentMethodFlags = {
  TABBY: false,
  TAMARA: false,
  CARD: true,
  MADA: true,
  AMKAN: false,
  CASH: true,
  APPLE_PAY: true,
  POINTS: false,
};

function asBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return fallback;
}

export function normalizeMobileAppPaymentMethodFlags(raw: unknown): MobileAppPaymentMethodFlags {
  const o =
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {};

  let flags: MobileAppPaymentMethodFlags = {
    TABBY: asBool(o.TABBY, DEFAULT_MOBILE_APP_PAYMENT_METHOD_FLAGS.TABBY),
    TAMARA: asBool(o.TAMARA, DEFAULT_MOBILE_APP_PAYMENT_METHOD_FLAGS.TAMARA),
    CARD: asBool(o.CARD, DEFAULT_MOBILE_APP_PAYMENT_METHOD_FLAGS.CARD),
    MADA: asBool(o.MADA, DEFAULT_MOBILE_APP_PAYMENT_METHOD_FLAGS.MADA),
    AMKAN: asBool(o.AMKAN, DEFAULT_MOBILE_APP_PAYMENT_METHOD_FLAGS.AMKAN),
    CASH: asBool(o.CASH, DEFAULT_MOBILE_APP_PAYMENT_METHOD_FLAGS.CASH),
    APPLE_PAY: asBool(o.APPLE_PAY, DEFAULT_MOBILE_APP_PAYMENT_METHOD_FLAGS.APPLE_PAY),
    POINTS: asBool(o.POINTS, DEFAULT_MOBILE_APP_PAYMENT_METHOD_FLAGS.POINTS),
  };

  // ضمان طريقة دفع واحدة على الأقل — نفس منطق باك اند التطبيق
  const anyEnabled = MOBILE_APP_PAYMENT_METHODS.some((m) => flags[m]);
  if (!anyEnabled) {
    flags = { ...flags, CARD: true };
  }

  return flags;
}
