import "server-only";
import { unstable_cache } from "next/cache";

/**
 * عميل بوابة إمكان (BNPL). التوثيق: BNPL Ecommerce Integration Specification V1.7
 * (Emkan Finance, نوفمبر 2025). مستقل تماماً عن lib/geidea و lib/tabby — لا استيراد
 * منهما ولا إليهما، حتى يمكن حذف هذا المجلد كاملاً دون أي أثر على بوابة أخرى.
 *
 * المصادقة: Basic Auth. المرجع الداخلي: نُرسل `orderId` خاصاً بنا عند الإنشاء
 * (صيغة booking-{id}-{ts})، وإمكان يرجع `orderId` خاصاً بها يُسمّى `orderCode` في
 * باقي الخدمات (حالة/استرداد/إلغاء).
 */

/**
 * أقل ما يلزم لأي نداء: العنوان والمصادقة ومعرّف التاجر. خدمة `merchantConfig`
 * تكتفي بهذا القدر — وهي التي تكشف `merchantCode` والحدود، فلا يصحّ أن تشترط
 * معرفتهما مسبقاً.
 */
export type AmkanCredentials = {
  merchantId: string;
  username: string;
  password: string;
  apiBase: string;
};

export type AmkanConfig = AmkanCredentials & {
  merchantCode: string;
  /** هيدر origin-source-channel — إلزامي عند إنشاء الطلب، لا قيمة افتراضية مضمَّنة عمداً. */
  originSourceChannel: string;
};

/** المصادقة وحدها من البيئة — دون اشتراط `merchantCode`/`originSourceChannel`. */
export function getAmkanCredentials(): AmkanCredentials | null {
  const merchantId = process.env.AMKAN_MERCHANT_ID?.trim();
  const username = process.env.AMKAN_USERNAME?.trim();
  const password = process.env.AMKAN_PASSWORD?.trim();
  const apiBase = process.env.AMKAN_API_BASE?.trim();
  if (!merchantId || !username || !password || !apiBase) return null;
  return { merchantId, username, password, apiBase: apiBase.replace(/\/$/, "") };
}

export function getAmkanConfig(): AmkanConfig | null {
  const merchantId = process.env.AMKAN_MERCHANT_ID?.trim();
  const username = process.env.AMKAN_USERNAME?.trim();
  const password = process.env.AMKAN_PASSWORD?.trim();
  const apiBase = process.env.AMKAN_API_BASE?.trim();
  const merchantCode = process.env.AMKAN_MERCHANT_CODE?.trim();
  const originSourceChannel = process.env.AMKAN_ORIGIN_SOURCE_CHANNEL?.trim();
  if (!merchantId || !username || !password || !apiBase || !merchantCode || !originSourceChannel) {
    return null;
  }
  return {
    merchantId,
    username,
    password,
    apiBase: apiBase.replace(/\/$/, ""),
    merchantCode,
    originSourceChannel,
  };
}

export function isAmkanConfigured(): boolean {
  return getAmkanConfig() != null;
}

/**
 * المبلغ بصيغة إمكان: **رقم** بعلامتين عشريتين لا نص — المواصفة V1.7 تنصّ على
 * `billAmount: Number` (مثالها `250.75`) و`refundAmount: Decimal`.
 */
function formatAmount(amountSar: number): number {
  return Math.round(amountSar * 100) / 100;
}

async function amkanFetch<T>(
  cfg: AmkanCredentials,
  path: string,
  init: {
    method: "GET" | "POST";
    body?: unknown;
    headers?: Record<string, string>;
    /**
     * `caller-reference-number`: إلزامي في Create Order (جدول 8)، ويعمل مفتاحَ
     * idempotency — «Using a used caller-reference-number will result in the same
     * response». يُمرَّر ثابتاً حيث تُهمّ عدم التكرار، وإلا يُولَّد عشوائياً.
     */
    callerReferenceNumber?: string;
  },
): Promise<T> {
  const url = `${cfg.apiBase}${path}`;
  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${Buffer.from(`${cfg.username}:${cfg.password}`).toString("base64")}`,
        channel: "BNPL",
        "caller-reference-number": init.callerReferenceNumber ?? crypto.randomUUID(),
        ...init.headers,
      },
      body: init.body != null ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch (err) {
    throw new Error(`Amkan network connection failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const text = await res.text();
  if (!res.ok) {
    throw new Error(`Amkan ${path} → HTTP ${res.status}: ${text.slice(0, 300)}`);
  }
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Amkan ${path} → Invalid JSON response`);
  }
}

export type AmkanMerchantLimits = {
  orderLowerLimit: number;
  orderUpperLimit: number;
};

/** يجلب سقوف المبلغ الفعلية من إمكان — تُستخدم لإخفاء الوسيلة قبل عرضها للعميل خارج النطاق. */
export async function fetchAmkanMerchantConfig(): Promise<AmkanMerchantLimits | null> {
  const cfg = getAmkanConfig();
  if (!cfg) return null;
  try {
    const data = await amkanFetch<{
      code?: string;
      orderLowerLimit?: number;
      orderUpperLimit?: number;
    }>(cfg, `/retail/bnpl/partner-management/v1/${encodeURIComponent(cfg.merchantId)}/merchantConfig`, {
      method: "GET",
    });
    if (data.code !== "I000000" || data.orderLowerLimit == null || data.orderUpperLimit == null) {
      return null;
    }
    return { orderLowerLimit: data.orderLowerLimit, orderUpperLimit: data.orderUpperLimit };
  } catch (e) {
    console.error("[amkan] merchant config fetch failed:", e);
    return null;
  }
}

/** نظير آمن للاستخدام من مكوّنات صفحة الدفع — لا يرمي أبداً. */
export async function amkanAmountLimitsOrNull(): Promise<AmkanMerchantLimits | null> {
  if (!isAmkanConfigured()) return null;
  return fetchAmkanMerchantConfig();
}

/**
 * نسخة تشخيصية من `merchantConfig` لأداة الاختبار الإدارية: تقبل بيانات اعتماد
 * صريحة (فـ`merchantCode` يُكتشف من هنا لا يُشترط قبلها) وتُرجع الرد **كاملاً**
 * دون تصفية — بما فيه زوجا الحدود `order*` و`bnpl*` معاً، وهما موضع السؤال المفتوح
 * لدى إمكان: أيّهما الملزم لطلبات BNPL. لا تُستخدم في مسار العميل.
 */
export async function fetchAmkanMerchantConfigRaw(
  creds: AmkanCredentials,
): Promise<Record<string, unknown>> {
  return amkanFetch<Record<string, unknown>>(
    creds,
    `/retail/bnpl/partner-management/v1/${encodeURIComponent(creds.merchantId)}/merchantConfig`,
    { method: "GET" },
  );
}

/**
 * السقوف مع كاش ساعة. تتغيّر نادراً جداً، وبدون الكاش ينتظر **كل** عرض لصفحة الدفع
 * نداءً شبكياً لإمكان — أي أن زمن عرض أهم صفحة عندنا يصير مرهوناً بتوفّر البوابة.
 */
export const cachedAmkanAmountLimits = unstable_cache(
  async () => amkanAmountLimitsOrNull(),
  ["amkan-merchant-limits"],
  { revalidate: 3600 },
);

export type AmkanOrderSession = {
  /** مرجعنا الداخلي (booking-{id}-{ts}) — يُخزَّن في paymentSessionRef. */
  orderId: string;
  /** معرّف إمكان (يُسمّى orderCode في باقي الخدمات) — يُخزَّن في paymentGatewayRef. */
  gatewayOrderId: string;
  paymentURL: string;
};

/**
 * إنشاء طلب تمويل. المبلغ يُحسب في السيرفر — لا يأتي من العميل أبداً.
 * POST /retail/bnpl/bff/v1/order-create
 */
export async function createAmkanOrder(args: {
  bookingRequestId: number;
  amountSar: number;
  mobileNumber?: string;
  /** HTTPS فقط. */
  callbackUrl?: string;
  returnUrl?: string;
  expiresInMinutes?: number;
}, cfgOverride?: AmkanConfig): Promise<AmkanOrderSession> {
  // التجاوز لأداة الاختبار الإدارية فقط، حيث تُجرَّب قيم `merchantCode` و
  // `origin-source-channel` قبل تثبيتها في البيئة. مسار العميل يمرّ دائماً بالبيئة.
  const cfg = cfgOverride ?? getAmkanConfig();
  if (!cfg) throw new Error("إمكان غير مهيّأة — أضف مفاتيح البيئة.");

  const orderId = `booking-${args.bookingRequestId}-${Date.now()}`;

  const data = await amkanFetch<{
    code?: string;
    description?: string;
    orderId?: string;
    paymentURL?: string;
  }>(cfg, "/retail/bnpl/bff/v1/order-create", {
    method: "POST",
    // مرجعنا نفسه يعمل مفتاح idempotency: إعادة المحاولة بنفس `orderId` تُرجع نفس
    // الرد بدل إنشاء طلب تمويل ثانٍ على العميل.
    callerReferenceNumber: orderId,
    headers: {
      "origin-source-channel": cfg.originSourceChannel,
      MERCHANT_CODE: cfg.merchantCode,
    },
    body: {
      orderId,
      merchantId: cfg.merchantId,
      billAmount: formatAmount(args.amountSar),
      ...(args.mobileNumber ? { mobileNumber: args.mobileNumber } : {}),
      ...(args.expiresInMinutes ? { expiresInMinutes: args.expiresInMinutes } : {}),
      ...(args.callbackUrl?.startsWith("https://") ? { callbackUrl: args.callbackUrl } : {}),
      ...(args.returnUrl?.startsWith("https://")
        ? { successRedirectionUrl: args.returnUrl, failureRedirectionUrl: args.returnUrl }
        : {}),
    },
  });

  if (data.code !== "I000000" || !data.orderId || !data.paymentURL) {
    throw new Error(`Amkan order creation failed: ${data.code ?? "?"} ${data.description ?? ""}`);
  }

  return { orderId, gatewayOrderId: data.orderId, paymentURL: data.paymentURL };
}

export type AmkanOrderStatus = {
  orderCode: string;
  statusCode: string;
  createdAt: string | null;
};

/**
 * جلب حالة الطلب (خادم‑لخادم) — مصدر الحقيقة للتحقق من إشعار Merchant Notifier،
 * لا نثق بجسم الإشعار وحده.
 * GET /retail/bnpl/bff/v1/order-status/{orderId}?merchantId={merchantId}
 */
export async function fetchAmkanOrderStatus(
  gatewayOrderId: string,
  credsOverride?: AmkanCredentials,
): Promise<AmkanOrderStatus> {
  const cfg = credsOverride ?? getAmkanConfig();
  if (!cfg) throw new Error("إمكان غير مهيّأة — أضف مفاتيح البيئة.");

  const data = await amkanFetch<{
    code?: string;
    description?: string;
    orderCode?: string;
    statusCode?: string;
    createdAt?: string;
  }>(
    cfg,
    `/retail/bnpl/bff/v1/order-status/${encodeURIComponent(gatewayOrderId)}?merchantId=${encodeURIComponent(cfg.merchantId)}`,
    { method: "GET" },
  );

  if (data.code !== "I000000" || !data.orderCode || !data.statusCode) {
    throw new Error(`Amkan order status fetch failed: ${data.code ?? "?"} ${data.description ?? ""}`);
  }
  return { orderCode: data.orderCode, statusCode: data.statusCode.toUpperCase(), createdAt: data.createdAt ?? null };
}

/** COMPLETED = العميل دفع الدفعة الأولى بنجاح (نظير "paid" عند جيديا). */
export function isAmkanOrderCompleted(order: AmkanOrderStatus): boolean {
  return order.statusCode === "COMPLETED";
}

/** رفض نهائي — مسار طبيعي وليس خطأ؛ لا تغيير على الحجز، العميل يختار وسيلة أخرى. */
export function isAmkanOrderRejected(order: AmkanOrderStatus): boolean {
  return order.statusCode === "REJECTED_IVR" || order.statusCode === "CANCELED";
}

/**
 * تقديم طلب استرداد. **غير متزامن**: الرد يؤكد الاستلام فقط، بلا معرّف استرداد؛
 * التنفيذ الفعلي يصل لاحقاً عبر Merchant Notifier (eventCode: FULLY_REFUND/PARTIAL_REFUND).
 * POST /retail/bnpl/bff/v1/order/refund/submit
 */
export async function submitAmkanRefund(args: {
  orderCode: string;
  refundAmountSar: number;
}): Promise<{ accepted: boolean }> {
  const cfg = getAmkanConfig();
  if (!cfg) throw new Error("إمكان غير مهيّأة — أضف مفاتيح البيئة.");

  const data = await amkanFetch<{ code?: string; description?: string }>(
    cfg,
    "/retail/bnpl/bff/v1/order/refund/submit",
    {
      method: "POST",
      body: {
        orderCode: args.orderCode,
        merchantCode: cfg.merchantCode,
        merchantId: cfg.merchantId,
        refundAmount: formatAmount(args.refundAmountSar),
      },
    },
  );

  if (data.code !== "I000000") {
    throw new Error(`Amkan refund submit failed: ${data.code ?? "?"} ${data.description ?? ""}`);
  }
  return { accepted: true };
}

export type AmkanRefundDetails = {
  orderAmount: number;
  totalCancelledAmount: number;
  remainingOrderAmount: number;
};

/** GET /retail/bnpl/bff/v1/order/refund-details/{orderCode}?merchantCode=&merchantId= */
export async function fetchAmkanRefundDetails(orderCode: string): Promise<AmkanRefundDetails> {
  const cfg = getAmkanConfig();
  if (!cfg) throw new Error("إمكان غير مهيّأة — أضف مفاتيح البيئة.");

  const data = await amkanFetch<{
    code?: string;
    description?: string;
    orderAmount?: string;
    totalCancelledAmount?: string;
    remainingOrderAmount?: string;
  }>(
    cfg,
    `/retail/bnpl/bff/v1/order/refund-details/${encodeURIComponent(orderCode)}?merchantCode=${encodeURIComponent(cfg.merchantCode)}&merchantId=${encodeURIComponent(cfg.merchantId)}`,
    { method: "GET" },
  );

  if (data.code !== "I000000") {
    throw new Error(`Amkan refund details fetch failed: ${data.code ?? "?"} ${data.description ?? ""}`);
  }
  return {
    orderAmount: Number(data.orderAmount ?? 0),
    totalCancelledAmount: Number(data.totalCancelledAmount ?? 0),
    remainingOrderAmount: Number(data.remainingOrderAmount ?? 0),
  };
}

/** POST /retail/bnpl/bnpl-bff/order/v1/cancelOrder */
export async function cancelAmkanOrder(orderCode: string): Promise<void> {
  const cfg = getAmkanConfig();
  if (!cfg) throw new Error("إمكان غير مهيّأة — أضف مفاتيح البيئة.");

  const data = await amkanFetch<{ code?: string; description?: string }>(
    cfg,
    "/retail/bnpl/bnpl-bff/order/v1/cancelOrder",
    {
      method: "POST",
      // MERCHANT_CODE إلزامي هنا أيضاً (جدول 26) — كان ناقصاً.
      headers: { MERCHANT_CODE: cfg.merchantCode },
      body: { orderCode, merchantId: cfg.merchantId },
    },
  );

  if (data.code !== "I000000") {
    throw new Error(`Amkan cancel order failed: ${data.code ?? "?"} ${data.description ?? ""}`);
  }
}
