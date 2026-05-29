/**
 * تفعيل/تعطيل طرق الدفع في صفحة دفع العميل (`/fleet/payment/[id]`).
 * يُخزَّن في SiteSetting كـ JSON — الافتراضي: الكل مفعّل.
 */

export const CUSTOMER_CHECKOUT_PAYMENT_METHODS = [
  "TABBY",
  "TAMARA",
  "CARD",
  "MADA",
  "AMKAN",
  "CASH",
  "APPLE_PAY",
  "POINTS",
] as const;

export type CustomerCheckoutPaymentMethod = (typeof CUSTOMER_CHECKOUT_PAYMENT_METHODS)[number];

export type CheckoutPaymentMethodFlags = Record<CustomerCheckoutPaymentMethod, boolean>;

export const DEFAULT_CHECKOUT_PAYMENT_METHOD_FLAGS: CheckoutPaymentMethodFlags = {
  TABBY: true,
  TAMARA: true,
  CARD: true,
  MADA: false,
  AMKAN: false,
  CASH: true,
  APPLE_PAY: true,
  POINTS: true,
};

function asBool(v: unknown, fallback: boolean): boolean {
  if (typeof v === "boolean") return v;
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return fallback;
}

export function normalizeCheckoutPaymentMethodFlags(raw: unknown): CheckoutPaymentMethodFlags {
  const o = raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  let flags: CheckoutPaymentMethodFlags = {
    TABBY: asBool(o.TABBY, DEFAULT_CHECKOUT_PAYMENT_METHOD_FLAGS.TABBY),
    TAMARA: asBool(o.TAMARA, DEFAULT_CHECKOUT_PAYMENT_METHOD_FLAGS.TAMARA),
    CARD: asBool(o.CARD, DEFAULT_CHECKOUT_PAYMENT_METHOD_FLAGS.CARD),
    MADA: asBool(o.MADA, DEFAULT_CHECKOUT_PAYMENT_METHOD_FLAGS.MADA),
    AMKAN: asBool(o.AMKAN, DEFAULT_CHECKOUT_PAYMENT_METHOD_FLAGS.AMKAN),
    CASH: asBool(o.CASH, DEFAULT_CHECKOUT_PAYMENT_METHOD_FLAGS.CASH),
    APPLE_PAY: asBool(o.APPLE_PAY, DEFAULT_CHECKOUT_PAYMENT_METHOD_FLAGS.APPLE_PAY),
    POINTS: asBool(o.POINTS, DEFAULT_CHECKOUT_PAYMENT_METHOD_FLAGS.POINTS),
  };

  const anyEnabled = CUSTOMER_CHECKOUT_PAYMENT_METHODS.some((m) => flags[m]);
  if (!anyEnabled) {
    flags = { ...flags, CARD: true };
  }

  return flags;
}

export function listEnabledCheckoutPaymentMethods(
  flags: CheckoutPaymentMethodFlags,
): CustomerCheckoutPaymentMethod[] {
  return CUSTOMER_CHECKOUT_PAYMENT_METHODS.filter((m) => flags[m]);
}

export function isCheckoutPaymentMethodEnabled(
  flags: CheckoutPaymentMethodFlags,
  method: string,
): boolean {
  const code = method.trim().toUpperCase() as CustomerCheckoutPaymentMethod;
  return (CUSTOMER_CHECKOUT_PAYMENT_METHODS as readonly string[]).includes(code) && flags[code];
}
