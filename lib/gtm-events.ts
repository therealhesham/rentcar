/**
 * Google Tag Manager (GTM) & DataLayer helper functions for analytics and payment tracking.
 *
 * Every function here is fail-silent: tracking must NEVER throw, log to the console,
 * or interrupt the payment / booking flow — whatever happens, the user sees nothing.
 */

import { e164ToLocalNine, saudiLocalNineToE164 } from "@/lib/normalize-saudi-phone";

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

function itemsOf(carName?: string, carId?: string | number | null) {
  if (!carName) return undefined;
  return [{ item_id: carId != null ? String(carId) : undefined, item_name: carName, quantity: 1 }];
}

/**
 * كائن ecommerce بصيغة GA4 القياسية — يلتقطه خيار «Send Ecommerce data» في علامة GA4
 * فتظهر المبيعات والعائد تلقائياً. الحقول المسطّحة تبقى كما هي لعلامة Google Ads القائمة.
 */
function ecommerceOf(p: {
  transactionId?: string | number | null;
  value?: number;
  paymentType?: string;
  carName?: string;
  carId?: string | number | null;
}) {
  return {
    transaction_id: p.transactionId != null ? String(p.transactionId) : undefined,
    value: p.value,
    currency: "SAR",
    payment_type: p.paymentType,
    items: itemsOf(p.carName, p.carId),
  };
}

/** يمسح ecommerce السابق ثم يرسل الحدث (توصية Google كي لا تتسرّب بيانات حدث لآخر). */
function pushEcommerceEvent(
  eventName: string,
  payload: Record<string, any>,
  ecommerce: Record<string, any>,
) {
  silently(() => {
    if (typeof window === "undefined") return;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({ ecommerce: null });
    pushGtmEvent(eventName, { ...payload, ecommerce });
  });
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
  carId?: string | number | null;
  paymentMethod?: string;
}) {
  silently(() =>
    pushEcommerceEvent(
      "begin_checkout",
      {
        booking_id: idOf(params?.bookingId),
        value: params?.amountSar,
        currency: "SAR",
        payment_type: params?.paymentMethod,
        items: itemsOf(params?.carName, params?.carId),
      },
      ecommerceOf({
        value: params?.amountSar,
        paymentType: params?.paymentMethod,
        carName: params?.carName,
        carId: params?.carId,
      }),
    ),
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
  carId?: string | number | null;
}) {
  silently(() =>
    pushGtmEvent("select_payment_option", {
      payment_type: params?.paymentMethod,
      booking_id: idOf(params?.bookingId),
      value: params?.amountSar,
      currency: "SAR",
      items: itemsOf(params?.carName, params?.carId),
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
  carId?: string | number | null;
}) {
  silently(() =>
    pushEcommerceEvent(
      "add_payment_info",
      {
        payment_type: params?.paymentMethod,
        booking_id: idOf(params?.bookingId),
        value: params?.amountSar,
        currency: "SAR",
        items: itemsOf(params?.carName, params?.carId),
      },
      ecommerceOf({
        value: params?.amountSar,
        paymentType: params?.paymentMethod,
        carName: params?.carName,
        carId: params?.carId,
      }),
    ),
  );
}

/**
 * Enhanced Conversions: بيانات العميل بصيغة Google (جوال دولي +966 وبريد صغير الحروف).
 * تُرسل **خاماً** — Google tag يشفّرها SHA-256 تلقائياً قبل الإرسال لإعلانات Google.
 */
function enhancedUserData(email?: string | null, phone?: string | null) {
  const mail = email?.trim().toLowerCase();
  const nine = e164ToLocalNine(phone);
  const e164 = nine ? saudiLocalNineToE164(nine) : null;
  const user_data: Record<string, string> = {};
  if (mail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mail)) user_data.email = mail;
  if (e164) user_data.phone_number = e164;
  return Object.keys(user_data).length ? user_data : undefined;
}

/**
 * Tracks a successful payment or confirmed booking purchase.
 * `email`/`phone` تغذّيان الإحالات المحسّنة (Enhanced Conversions) في Google Ads عبر `user_data`.
 */
export function trackPurchaseSuccess(params: {
  bookingId: string | number;
  paymentMethod: string;
  amountSar: number;
  carName?: string;
  carId?: string | number | null;
  email?: string | null;
  phone?: string | null;
}) {
  silently(() => {
    // مرة واحدة لكل حجز على هذا المتصفح: صفحة الدفع تُعاد زيارتها (refresh / رجوع من البوابة)
    // وكل زيارة لحجز مكتمل كانت تُرسل purchase جديداً فتتضخّم الإحالات.
    const sentKey = "rw_purchase_sent_" + idOf(params?.bookingId);
    try {
      if (window.localStorage.getItem(sentKey)) return;
    } catch {
      /* التخزين غير متاح — نُرسل ولا نمنع */
    }

    pushEcommerceEvent(
      "purchase",
      {
        user_data: enhancedUserData(params?.email, params?.phone),
        transaction_id: idOf(params?.bookingId),
        value: params?.amountSar,
        currency: "SAR",
        payment_type: params?.paymentMethod,
        items: itemsOf(params?.carName, params?.carId),
      },
      ecommerceOf({
        transactionId: params?.bookingId,
        value: params?.amountSar,
        paymentType: params?.paymentMethod,
        carName: params?.carName,
        carId: params?.carId,
      }),
    );

    try {
      window.localStorage.setItem(sentKey, String(Date.now()));
    } catch {
      /* ignore */
    }
  });
}
