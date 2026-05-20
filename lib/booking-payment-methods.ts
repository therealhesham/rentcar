/** طرق الدفع المخزّنة على الحجز — موحّدة بين الموقع والإدارة. */

export const BOOKING_PAYMENT_METHODS = [
  "CASH",
  "CARD",
  "TABBY",
  "TAMARA",
  "APPLE_PAY",
  "POINTS",
] as const;

export type BookingPaymentMethod = (typeof BOOKING_PAYMENT_METHODS)[number];

/** ترتيب مناسب لحجز المكتب (نقدي أولاً). */
export const ADMIN_OFFICE_PAYMENT_METHODS: BookingPaymentMethod[] = [
  "CASH",
  "CARD",
  "TABBY",
  "TAMARA",
  "APPLE_PAY",
  "POINTS",
];

export function isBookingPaymentMethod(code: string): code is BookingPaymentMethod {
  return (BOOKING_PAYMENT_METHODS as readonly string[]).includes(code.trim().toUpperCase());
}

export function parseAdminOfficePaymentFromFormData(
  formData: FormData,
): { ok: true; recordNow: false } | { ok: true; recordNow: true; method: BookingPaymentMethod } | { ok: false; error: string } {
  const timing = String(formData.get("paymentTiming") ?? "later").trim().toLowerCase();
  if (timing !== "now") {
    return { ok: true, recordNow: false };
  }
  const raw = String(formData.get("paymentMethod") ?? "CASH").trim().toUpperCase();
  if (!isBookingPaymentMethod(raw)) {
    return { ok: false, error: "طريقة الدفع غير صالحة." };
  }
  return { ok: true, recordNow: true, method: raw };
}
