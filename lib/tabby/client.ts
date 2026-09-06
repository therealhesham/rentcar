import "server-only";

/**
 * عميل بوابة Tabby (KSA/Global).
 * التوثيق: https://docs.tabby.ai
 */

export type TabbyConfig = {
  publicKey: string;
  secretKey: string;
  merchantCode: string;
  apiBase: string;
};

export function getTabbyConfig(): TabbyConfig | null {
  const publicKey = process.env.TABBY_PUBLIC_KEY?.trim();
  const secretKey = process.env.TABBY_SECRET_KEY?.trim();
  const merchantCode = (process.env.TABBY_MERCHANT_CODE?.trim() || "au");
  if (!publicKey || !secretKey) return null;
  return {
    publicKey,
    secretKey,
    merchantCode,
    apiBase: (process.env.TABBY_API_BASE?.trim() || "https://api.tabby.ai").replace(/\/$/, ""),
  };
}

export function isTabbyConfigured(): boolean {
  return getTabbyConfig() != null;
}

/** المبلغ بصيغة تابي: رقم بعلامتين عشريتين (نص). */
function formatAmount(amountSar: number): string {
  return (Math.round(amountSar * 100) / 100).toFixed(2);
}

async function tabbyFetch<T>(
  cfg: TabbyConfig,
  path: string,
  useSecretKey: boolean,
  init: { method: "GET" | "POST"; body?: unknown; extraHeaders?: Record<string, string> },
): Promise<T> {
  const url = `${cfg.apiBase}${path}`;
  const apiKey = useSecretKey ? cfg.secretKey : cfg.publicKey;
  console.log(`[Tabby Client] 🚀 Request ${init.method} -> ${url}`);
  if (init.body) {
    console.log(`[Tabby Client] 📤 Payload:`, JSON.stringify(init.body, null, 2));
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: init.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
        ...init.extraHeaders,
      },
      body: init.body != null ? JSON.stringify(init.body) : undefined,
      cache: "no-store",
    });
  } catch (err) {
    console.error(`[Tabby Client] 💥 Network fetch failed for ${url}:`, err);
    throw new Error(`Tabby network connection failed: ${err instanceof Error ? err.message : String(err)}`);
  }

  const text = await res.text();
  console.log(`[Tabby Client] 📥 Response HTTP ${res.status} for ${path}`);
  console.log(`[Tabby Client] 📄 Raw Response Body:`, text);

  if (!res.ok) {
    console.error(`[Tabby Client] ❌ HTTP ${res.status} Error:`, text);
    throw new Error(`Tabby ${path} → HTTP ${res.status}: ${text.slice(0, 300)}`);
  }

  try {
    return JSON.parse(text) as T;
  } catch (parseErr) {
    console.error(`[Tabby Client] ❌ Failed to parse JSON response from Tabby:`, text);
    throw new Error(`Tabby ${path} → Invalid JSON response`);
  }
}

export type TabbyCheckoutSession = {
  sessionId: string;
  paymentId: string;
  webUrl: string;
  merchantReferenceId: string;
  status: string;
};

export type TabbyBuyerInfo = {
  phone?: string | null;
  email?: string | null;
  name?: string | null;
  dob?: string | null;
};

export type TabbyShippingAddress = {
  city?: string | null;
  address?: string | null;
  zip?: string | null;
};

export type TabbyOrderItem = {
  title: string;
  description?: string;
  quantity: number;
  unitPriceSar: number;
  category?: string;
  referenceId?: string;
};

/**
 * فحص أهلية العميل لدفع التابي (Eligibility check).
 */
export type TabbyEligibility = {
  /**
   * `rejected` = تابي ردّت فعلاً برفض ⇒ نُعطّل الخيار.
   * `unknown` = تعذّر الوصول لتابي (شبكة/مهلة) ⇒ **لا نُعطّل**؛ نترك العميل يجرّب
   * وصفحة تابي نفسها ترفض إن كان غير مؤهَّل. تعطيلها هنا كان يخسر بيعاً بسبب
   * عطل شبكي مؤقت عندنا لا علاقة له بأهلية العميل.
   */
  status: "eligible" | "rejected" | "unknown";
  rejectionReason?: string;
};

export async function checkTabbyEligibility(args: {
  amountSar: number;
  buyer: TabbyBuyerInfo;
}): Promise<TabbyEligibility> {
  const cfg = getTabbyConfig();
  if (!cfg) return { status: "unknown", rejectionReason: "TABBY_NOT_CONFIGURED" };

  try {
    const amount = formatAmount(args.amountSar);
    const data = await tabbyFetch<{
      status?: string;
      configuration?: {
        available_products?: {
          installments?: Array<{ web_url?: string }>;
        };
        rejection_reason?: string;
      };
    }>(cfg, "/api/v2/checkout", false, {
      method: "POST",
      body: {
        payment: {
          amount,
          currency: "SAR",
          buyer: {
            phone: args.buyer.phone || "+966500000000",
            email: args.buyer.email || "customer@example.com",
            name: args.buyer.name || "Customer",
          },
        },
        merchant_code: cfg.merchantCode,
      },
    });

    const installments = data.configuration?.available_products?.installments;
    const isEligible = Array.isArray(installments) && installments.length > 0;
    return {
      status: isEligible ? "eligible" : "rejected",
      rejectionReason: data.configuration?.rejection_reason,
    };
  } catch (err) {
    // فشل شبكي/مهلة — ليس رفضاً من تابي.
    console.error("[checkTabbyEligibility] unreachable:", err);
    return { status: "unknown", rejectionReason: String(err) };
  }
}

/**
 * إنشاء جلسة دفع تابي (Checkout Session).
 * المبلغ يُحسب في السيرفر — لا يأتي من العميل.
 */
export async function createTabbyCheckoutSession(args: {
  bookingRequestId: number;
  amountSar: number;
  buyer: TabbyBuyerInfo;
  /** سياق العميل لتقييم مخاطر تابي — يُحذف من الحمولة لو غير متوفر (مثلاً أداة الاختبار الداخلية). */
  buyerHistory?: { registeredSinceIso?: string | null; loyaltyLevel?: number };
  /** عنوان فرع الاستلام أو عنوان التوصيل — مطلوب حسب توثيق تابي. */
  shippingAddress?: TabbyShippingAddress;
  items?: TabbyOrderItem[];
  successUrl: string;
  cancelUrl: string;
  failureUrl: string;
  language?: "ar" | "en";
}): Promise<TabbyCheckoutSession> {
  const cfg = getTabbyConfig();
  if (!cfg) throw new Error("Tabby غير مهيّأة — أضف مفاتيح البيئة.");

  const amount = formatAmount(args.amountSar);
  const merchantReferenceId = `booking-${args.bookingRequestId}-${Date.now()}`;

  const formattedItems = (args.items && args.items.length > 0)
    ? args.items.map((item) => ({
        title: item.title,
        description: item.description || "",
        quantity: item.quantity,
        unit_price: formatAmount(item.unitPriceSar),
        category: item.category || "Car Rental",
        reference_id: item.referenceId || `item-${args.bookingRequestId}`,
      }))
    : [
        {
          title: `حجز سيارة رقم #${args.bookingRequestId}`,
          description: "تأجير سيارة",
          quantity: 1,
          unit_price: amount,
          category: "Car Rental",
          reference_id: `booking-${args.bookingRequestId}`,
        },
      ];

  const payload = {
    payment: {
      amount,
      currency: "SAR",
      description: `حجز سيارة رقم #${args.bookingRequestId}`,
      buyer: {
        phone: args.buyer.phone || "+966500000000",
        email: args.buyer.email || "customer@example.com",
        name: args.buyer.name || "Customer",
        dob: args.buyer.dob || undefined,
      },
      ...(args.buyerHistory
        ? {
            buyer_history: {
              registered_since: args.buyerHistory.registeredSinceIso || undefined,
              loyalty_level: args.buyerHistory.loyaltyLevel ?? 0,
            },
          }
        : {}),
      ...(args.shippingAddress
        ? {
            shipping_address: {
              city: args.shippingAddress.city || undefined,
              address: args.shippingAddress.address || undefined,
              zip: args.shippingAddress.zip || "",
            },
          }
        : {}),
      order: {
        tax_amount: "0.00",
        shipping_amount: "0.00",
        discount_amount: "0.00",
        updated_at: new Date().toISOString(),
        reference_id: merchantReferenceId,
        items: formattedItems,
      },
      // مصفوفة فارغة لعميل جديد بلا حجوزات سابقة — Tabby's "Session payload model"
      // (sub-fields غير موثّقة في quick-start) لسه محتاجة مراجعة لملئها بحجوزات حقيقية.
      order_history: [],
    },
    lang: args.language || "ar",
    merchant_code: cfg.merchantCode,
    merchant_urls: {
      success: args.successUrl,
      cancel: args.cancelUrl,
      failure: args.failureUrl,
    },
  };

  const data = await tabbyFetch<{
    id?: string;
    status?: string;
    payment?: {
      id?: string;
      status?: string;
    };
    configuration?: {
      available_products?: {
        installments?: Array<{ web_url?: string }>;
      };
    };
  }>(cfg, "/api/v2/checkout", true, {
    method: "POST",
    body: payload,
  });

  const sessionId = data.id;
  const paymentId = data.payment?.id || sessionId;
  const installments = data.configuration?.available_products?.installments;
  const webUrl = installments?.[0]?.web_url;

  if (!sessionId || !webUrl) {
    throw new Error(`Tabby session creation failed or payment method not available: status ${data.status}`);
  }

  return {
    sessionId,
    paymentId: paymentId || sessionId || "",
    webUrl,
    merchantReferenceId,
    status: data.status || "created",
  };
}

export type TabbyPayment = {
  id: string;
  status: "AUTHORIZED" | "CLOSED" | "REJECTED" | "EXPIRED" | "CANCELED" | string;
  amount: number;
  currency: string;
  merchantCode: string;
  orderReferenceId: string | null;
};

/**
 * جلب تفاصيل دفع تابي بواسطة ID (خادم-لخادم).
 */
export async function fetchTabbyPayment(paymentId: string): Promise<TabbyPayment> {
  const cfg = getTabbyConfig();
  if (!cfg) throw new Error("Tabby غير مهيّأة — أضف مفاتيح البيئة.");

  const data = await tabbyFetch<{
    id?: string;
    status?: string;
    amount?: string | number;
    currency?: string;
    merchant_code?: string;
    order?: {
      reference_id?: string;
    };
  }>(cfg, `/api/v2/payments/${encodeURIComponent(paymentId)}`, true, {
    method: "GET",
  });

  if (!data.id) {
    throw new Error(`Tabby fetch payment failed for ID: ${paymentId}`);
  }

  return {
    id: data.id,
    status: (data.status || "").toUpperCase(),
    amount: Number(data.amount || 0),
    currency: data.currency || "SAR",
    merchantCode: data.merchant_code || "",
    orderReferenceId: data.order?.reference_id || null,
  };
}

/**
 * تأكيد/تحصيل الدفع (Capture).
 * تحويل الدفع من AUTHORIZED إلى CLOSED (تم التحصيل).
 */
export async function captureTabbyPayment(args: {
  paymentId: string;
  amountSar: number;
  referenceId?: string;
}): Promise<{ status: string }> {
  const cfg = getTabbyConfig();
  if (!cfg) throw new Error("Tabby غير مهيّأة — أضف مفاتيح البيئة.");

  const amount = formatAmount(args.amountSar);
  const data = await tabbyFetch<{ status?: string }>(
    cfg,
    `/api/v2/payments/${encodeURIComponent(args.paymentId)}/captures`,
    true,
    {
      method: "POST",
      body: {
        amount,
        reference_id: args.referenceId || `capture-${Date.now()}`,
      },
    },
  );

  return { status: data.status || "CLOSED" };
}

/**
 * استرداد دفع تابي (Refund).
 */
export async function refundTabbyPayment(args: {
  paymentId: string;
  amountSar: number;
  reason?: string;
  /** فريد لكل استرداد منطقي — إعادة استخدامه تُعيد نفس الاسترداد الأصلي بدل تكراره. */
  referenceId?: string;
}): Promise<{ refundId: string; status: string }> {
  const cfg = getTabbyConfig();
  if (!cfg) throw new Error("Tabby غير مهيّأة — أضف مفاتيح البيئة.");

  const amount = formatAmount(args.amountSar);
  const data = await tabbyFetch<{ id?: string; status?: string }>(
    cfg,
    `/api/v2/payments/${encodeURIComponent(args.paymentId)}/refunds`,
    true,
    {
      method: "POST",
      body: {
        amount,
        reason: args.reason || "Booking Refund",
        reference_id: args.referenceId || `refund-${args.paymentId}-${Date.now()}`,
      },
    },
  );

  return {
    refundId: data.id || `TABBY-REFUND-${Date.now()}`,
    status: data.status || "REFUNDED",
  };
}

export type TabbyWebhook = { id: string; url: string };

/**
 * جلب قائمة الـwebhooks المسجّلة لدى تابي.
 */
export async function listTabbyWebhooks(): Promise<TabbyWebhook[]> {
  const cfg = getTabbyConfig();
  if (!cfg) throw new Error("Tabby غير مهيّأة — أضف مفاتيح البيئة.");

  const data = await tabbyFetch<TabbyWebhook[] | { items?: TabbyWebhook[] }>(
    cfg, "/api/v1/webhooks", true,
    { method: "GET", extraHeaders: { "X-Merchant-Code": cfg.merchantCode } },
  );

  // Tabby may return an array directly or wrap it in { items: [] }
  if (Array.isArray(data)) return data;
  return (data as { items?: TabbyWebhook[] }).items ?? [];
}

/**
 * تسجيل رابط الـwebhook لدى تابي — idempotent:
 * إن كان الـwebhook مسجّلاً بالفعل ("webhook already exists") تُعاد بياناته
 * بدل رمي خطأ، مما يُتيح إعادة تشغيل السكريبت بأمان في أي وقت.
 *
 * تُشغَّل يدوياً عبر scripts/register-tabby-webhook.ts، مش من
 * أي مسار في التطبيق — تُغيّر إعدادات حساب تابي فلا يصح تنفيذها تلقائياً.
 */
export async function registerTabbyWebhook(webhookUrl: string): Promise<{ id: string; url: string; alreadyExisted?: boolean }> {
  const cfg = getTabbyConfig();
  if (!cfg) throw new Error("Tabby غير مهيّأة — أضف مفاتيح البيئة.");

  try {
    const data = await tabbyFetch<{ id?: string; url?: string }>(cfg, "/api/v1/webhooks", true, {
      method: "POST",
      body: { url: webhookUrl },
      extraHeaders: { "X-Merchant-Code": cfg.merchantCode },
    });
    if (!data.id) throw new Error("Tabby webhook registration returned no id.");
    return { id: data.id, url: data.url || webhookUrl };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // Tabby returns HTTP 400 "webhook already exists" when re-registering the same URL.
    // That means the webhook IS active — treat it as a success.
    if (msg.includes("webhook already exists")) {
      console.log("[Tabby] Webhook already registered — fetching existing entry...");
      const existing = await listTabbyWebhooks();
      const match = existing.find((w) => w.url === webhookUrl) ?? existing[0];
      if (match) return { ...match, alreadyExisted: true };
      // Registered but list returned nothing — still not an error.
      return { id: "unknown", url: webhookUrl, alreadyExisted: true };
    }
    throw err;
  }
}
