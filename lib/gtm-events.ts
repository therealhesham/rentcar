/**
 * Google Tag Manager (GTM) & DataLayer helper functions for analytics and payment tracking.
 *
 * Every function here is fail-silent: tracking must NEVER throw, log to the console,
 * or interrupt the payment / booking flow — whatever happens, the user sees nothing.
 */

declare global {
  interface Window {
    dataLayer?: Record<string, any>[];
  }
}

/** Runs `fn` and swallows any error silently. */
function silently(fn: () => void): void {
  try {
    fn();
  } catch {
    // intentionally empty
  }
}

function itemsOf(carName?: string) {
  return carName ? [{ item_name: carName }] : undefined;
}

function idOf(id?: string | number | null) {
  return id != null ? String(id) : undefined;
}

/**
 * Pushes a generic event to GTM dataLayer safely on client side.
 */
export function pushGtmEvent(eventName: string, payload: Record<string, any> = {}) {
  silently(() => {
    if (typeof window === "undefined") return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ event: eventName, ...payload });
  });
}

/**
 * Tracks when a user opens the payment / checkout page.
 */
export function trackBeginCheckout(params: {
  bookingId?: string | number;
  amountSar?: number;
  carName?: string;
  paymentMethod?: string;
}) {
  silently(() =>
    pushGtmEvent("begin_checkout", {
      booking_id: idOf(params?.bookingId),
      value: params?.amountSar,
      currency: "SAR",
      payment_type: params?.paymentMethod,
      items: itemsOf(params?.carName),
    }),
  );
}

/**
 * Tracks when a user selects or changes a payment method (e.g. GEIDEA, CARD, MADA, TABBY, TAMARA, CASH, AMKAN, APPLE_PAY).
 */
export function trackSelectPaymentMethod(params: {
  paymentMethod: string;
  bookingId?: string | number;
  amountSar?: number;
  carName?: string;
}) {
  silently(() =>
    pushGtmEvent("select_payment_option", {
      payment_type: params?.paymentMethod,
      booking_id: idOf(params?.bookingId),
      value: params?.amountSar,
      currency: "SAR",
      items: itemsOf(params?.carName),
    }),
  );
}

/**
 * Tracks when payment details are submitted or user is redirected to a payment gateway (Geidea, Tabby, etc.).
 */
export function trackSubmitPayment(params: {
  paymentMethod: string;
  bookingId?: string | number;
  amountSar?: number;
  carName?: string;
}) {
  silently(() =>
    pushGtmEvent("add_payment_info", {
      payment_type: params?.paymentMethod,
      booking_id: idOf(params?.bookingId),
      value: params?.amountSar,
      currency: "SAR",
      items: itemsOf(params?.carName),
    }),
  );
}

/**
 * Tracks a successful payment or confirmed booking purchase.
 */
export function trackPurchaseSuccess(params: {
  bookingId: string | number;
  paymentMethod: string;
  amountSar: number;
  carName?: string;
}) {
  silently(() =>
    pushGtmEvent("purchase", {
      transaction_id: idOf(params?.bookingId),
      value: params?.amountSar,
      currency: "SAR",
      payment_type: params?.paymentMethod,
      items: itemsOf(params?.carName),
    }),
  );
}
