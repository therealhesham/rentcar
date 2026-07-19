import "server-only";
import crypto from "node:crypto";

/**
 * عميل بوابة جيديا (KSA). التوثيق: https://docs.geidea.net
 * التوقيع: Base64(HMAC-SHA256(concat, API_PASSWORD)) — ترتيب الحقول يختلف بين
 * إنشاء الجلسة والاسترداد (انظر كل دالة).
 */

type GeideaConfig = {
  publicKey: string;
  apiPassword: string;
  apiBase: string;
  hppBase: string;
};

export function getGeideaConfig(): GeideaConfig | null {
  const publicKey = process.env.GEIDEA_PUBLIC_KEY?.trim();
  const apiPassword = process.env.GEIDEA_API_PASSWORD?.trim();
  if (!publicKey || !apiPassword) return null;
  return {
    publicKey,
    apiPassword,
    apiBase: (process.env.GEIDEA_API_BASE?.trim() || "https://api.ksamerchant.geidea.net").replace(/\/$/, ""),
    hppBase: (process.env.GEIDEA_HPP_BASE?.trim() || "https://www.ksamerchant.geidea.net").replace(/\/$/, ""),
  };
}

export function isGeideaConfigured(): boolean {
  return getGeideaConfig() != null;
}

/** المبلغ بصيغة جيديا: رقم بعلامتين عشريتين (نص). */
function formatAmount(amountSar: number): string {
  return (Math.round(amountSar * 100) / 100).toFixed(2);
}

/** طابع زمني ISO بدون أجزاء الثانية — كما في أمثلة جيديا (2024-09-24T15:31:34Z). */
function isoTimestamp(): string {
  return new Date().toISOString().replace(/\.\d{3}Z$/, "Z");
}

function hmacBase64(data: string, key: string): string {
  return crypto.createHmac("sha256", key).update(data).digest("base64");
}

async function geideaFetch<T>(
  cfg: GeideaConfig,
  path: string,
  init: { method: "GET" | "POST"; body?: unknown },
): Promise<T> {
  const res = await fetch(`${cfg.apiBase}${path}`, {
    method: init.method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Basic ${Buffer.from(`${cfg.publicKey}:${cfg.apiPassword}`).toString("base64")}`,
    },
    body: init.body != null ? JSON.stringify(init.body) : undefined,
    cache: "no-store",
  });
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Geidea ${path} → HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text) as T;
}

export type GeideaSession = {
  sessionId: string;
  /** رابط صفحة الدفع المستضافة (HPP) لتحويل العميل إليها. */
  redirectUrl: string;
  merchantReferenceId: string;
};

/**
 * إنشاء جلسة دفع (HPP Checkout). المبلغ يُحسب في السيرفر — لا يأتي من العميل أبداً.
 * توقيع الجلسة: HMAC على {publicKey}{amount}{currency}{merchantReferenceId}{timestamp}.
 */
export async function createGeideaCheckoutSession(args: {
  bookingRequestId: number;
  amountSar: number;
  /** HTTPS فقط — يُهمَل إن لم يكن كذلك (بيئة تطوير محلية). */
  callbackUrl?: string;
  /** HTTPS فقط — غير ذلك تستخدم جيديا صفحتها الافتراضية بعد الدفع. */
  returnUrl?: string;
  language?: "ar" | "en";
}): Promise<GeideaSession> {
  const cfg = getGeideaConfig();
  if (!cfg) throw new Error("Geidea غير مهيّأة — أضف مفاتيح البيئة.");

  const amount = formatAmount(args.amountSar);
  const currency = "SAR";
  const merchantReferenceId = `booking-${args.bookingRequestId}-${Date.now()}`;
  const timestamp = isoTimestamp();
  const signature = hmacBase64(
    `${cfg.publicKey}${amount}${currency}${merchantReferenceId}${timestamp}`,
    cfg.apiPassword,
  );

  const data = await geideaFetch<{
    session?: { id?: string };
    responseCode?: string;
    responseMessage?: string;
    detailedResponseMessage?: string;
  }>(cfg, "/payment-intent/api/v2/direct/session", {
    method: "POST",
    body: {
      amount,
      currency,
      timestamp,
      merchantReferenceId,
      signature,
      paymentOperation: "Pay",
      language: args.language ?? "ar",
      ...(args.callbackUrl?.startsWith("https://")
        ? { callbackUrl: args.callbackUrl }
        : {}),
      ...(args.returnUrl?.startsWith("https://")
        ? { returnUrl: args.returnUrl }
        : {}),
    },
  });

  const sessionId = data.session?.id;
  if (data.responseCode !== "000" || !sessionId) {
    throw new Error(
      `Geidea session failed: ${data.responseCode} ${data.detailedResponseMessage ?? data.responseMessage ?? ""}`,
    );
  }

  return {
    sessionId,
    redirectUrl: `${cfg.hppBase}/hpp/checkout/?${sessionId}`,
    merchantReferenceId,
  };
}

export type GeideaRefundResult = {
  refundTransactionRef: string;
  orderStatus: string;
  totalRefundedAmount: number | null;
};

/**
 * استرداد كامل أو جزئي على عملية دفع سابقة (orderId من الحجز).
 * توقيع الاسترداد: HMAC على {timestamp}{publicKey}{refundAmount}{orderId}.
 */
export async function refundGeideaPayment(args: {
  paymentGatewayRef: string;
  amountSar: number;
}): Promise<GeideaRefundResult> {
  const cfg = getGeideaConfig();
  if (!cfg) throw new Error("Geidea غير مهيّأة — أضف مفاتيح البيئة.");

  const refundAmount = formatAmount(args.amountSar);
  const timestamp = isoTimestamp();
  const signature = hmacBase64(
    `${timestamp}${cfg.publicKey}${refundAmount}${args.paymentGatewayRef}`,
    cfg.apiPassword,
  );

  const data = await geideaFetch<{
    responseCode?: string;
    responseMessage?: string;
    detailedResponseMessage?: string;
    order?: {
      status?: string;
      detailedStatus?: string;
      totalRefundedAmount?: number;
      transactions?: Array<{ transactionId?: string; type?: string; status?: string }>;
    };
  }>(cfg, "/pgw/api/v2/direct/refund", {
    method: "POST",
    body: {
      orderId: args.paymentGatewayRef,
      refundAmount,
      timestamp,
      signature,
    },
  });

  const orderStatus = data.order?.detailedStatus ?? data.order?.status ?? "";
  if (data.responseCode !== "000") {
    throw new Error(
      `Geidea refund failed: ${data.responseCode} ${data.detailedResponseMessage ?? data.responseMessage ?? ""}`,
    );
  }

  const refundTx = data.order?.transactions?.find(
    (t) => (t.type ?? "").toLowerCase().includes("refund") && t.transactionId,
  );

  return {
    refundTransactionRef:
      refundTx?.transactionId ?? `GEIDEA-REFUND-${args.paymentGatewayRef}`,
    orderStatus,
    totalRefundedAmount: data.order?.totalRefundedAmount ?? null,
  };
}

export type GeideaOrder = {
  orderId: string;
  status: string;
  detailedStatus: string;
  amount: number;
  currency: string;
  merchantReferenceId: string | null;
  /** ماركة وسيلة الدفع لدى جيديا (mada / visa / mastercard / …) إن توفرت. */
  paymentBrand: string | null;
};

/**
 * جلب تفاصيل طلب من جيديا (خادم‑لخادم) — مصدر الحقيقة للتحقق من الـ webhook:
 * لا نثق بجسم الإشعار؛ نتحقق من الحالة مباشرةً من API جيديا عبر Basic Auth.
 */
export async function fetchGeideaOrder(orderId: string): Promise<GeideaOrder> {
  const cfg = getGeideaConfig();
  if (!cfg) throw new Error("Geidea غير مهيّأة — أضف مفاتيح البيئة.");

  const data = await geideaFetch<{
    order?: GeideaRawOrder;
    responseCode?: string;
    responseMessage?: string;
  }>(cfg, `/pgw/api/v1/direct/order/${encodeURIComponent(orderId)}`, {
    method: "GET",
  });

  const o = data.order;
  if (!o?.orderId) {
    throw new Error(`Geidea order fetch failed: ${data.responseCode} ${data.responseMessage ?? ""}`);
  }
  return normalizeGeideaOrder(o);
}

type GeideaRawOrder = {
  orderId?: string;
  status?: string;
  detailedStatus?: string;
  amount?: number;
  totalAmount?: number;
  currency?: string;
  merchantReferenceId?: string;
  paymentMethod?: { brand?: string; wallet?: string | null } | null;
};

function normalizeGeideaOrder(o: GeideaRawOrder): GeideaOrder {
  const wallet = o.paymentMethod?.wallet?.trim();
  return {
    orderId: o.orderId ?? "",
    status: o.status ?? "",
    detailedStatus: o.detailedStatus ?? "",
    amount: Number(o.totalAmount ?? o.amount ?? 0),
    currency: o.currency ?? "",
    merchantReferenceId: o.merchantReferenceId ?? null,
    paymentBrand: wallet || o.paymentMethod?.brand?.trim() || null,
  };
}

/**
 * جلب طلب بمرجع التاجر (merchantReferenceId) — للمصالحة عند عودة العميل من
 * صفحة الدفع قبل وصول الـ webhook. يُرجع null إن لم يوجد طلب بعد.
 */
export async function fetchGeideaOrderByMerchantReference(
  merchantReferenceId: string,
): Promise<GeideaOrder | null> {
  const cfg = getGeideaConfig();
  if (!cfg) throw new Error("Geidea غير مهيّأة — أضف مفاتيح البيئة.");

  const data = await geideaFetch<{ orders?: GeideaRawOrder[] }>(
    cfg,
    `/pgw/api/v1/direct/order?Reference=${encodeURIComponent(merchantReferenceId)}&Take=1`,
    { method: "GET" },
  );

  const o = data.orders?.find((x) => x.merchantReferenceId === merchantReferenceId);
  if (!o?.orderId) return null;
  return normalizeGeideaOrder(o);
}
