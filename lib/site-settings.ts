import { prisma } from "@/lib/prisma";
import {
  DEFAULT_BOOKING_WIDGET_TAB_FLAGS,
  normalizeBookingWidgetTabFlags,
  type BookingWidgetTabFlags,
} from "@/lib/booking-widget-tabs";
import {
  DEFAULT_CHECKOUT_PAYMENT_METHOD_FLAGS,
  normalizeCheckoutPaymentMethodFlags,
  type CheckoutPaymentMethodFlags,
} from "@/lib/checkout-payment-method-flags";
import {
  parseRentalPriceDisplayMode,
  type RentalPriceDisplayMode,
} from "@/lib/pricing";
import {
  parseCancellationDeductTiersJson,
  type CancellationDeductTier,
} from "@/lib/cancellation-deduct";
import { isTrustedSpacesImageUrl } from "@/lib/spaces-upload";

/* ─── Promo Banner (Carousel) ──────────────────────────────── */
export const SITE_KEY_PROMO_BANNER_SLIDES = "promo_banner_slides";

export type PromoBannerSlide = {
  imageUrl: string;
  linkUrl: string;
};

export function isAllowedPromoBannerImageUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  if (isTrustedSpacesImageUrl(u)) return true;
  try {
    const p = new URL(u);
    return (
      p.protocol === "https:" &&
      (p.hostname === "lh3.googleusercontent.com" ||
        p.hostname === "images.unsplash.com")
    );
  } catch {
    return false;
  }
}

export async function getPromoBannerSlides(): Promise<PromoBannerSlide[]> {
  try {
    const row = await prisma.siteSetting.findUnique({
      where: { key: SITE_KEY_PROMO_BANNER_SLIDES },
      select: { value: true },
    });
    if (!row?.value) return [];
    const parsed = JSON.parse(row.value) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (s): s is PromoBannerSlide =>
        typeof s === "object" && s !== null &&
        typeof (s as PromoBannerSlide).imageUrl === "string" &&
        (s as PromoBannerSlide).imageUrl.trim() !== "",
    );
  } catch {
    return [];
  }
}
/* ──────────────────────────────────────────────────────────── */

/**
 * صورة الهيرو الافتراضية — التصميم الحالي خلفية واحدة كاملة العرض (لا صورتان
 * يمين/يسار كما في تصميم سابق)، فالإعداد صورة واحدة فقط.
 */
export const DEFAULT_HOME_HERO_IMAGE_URL = "/heros.webp";

export const DEFAULT_HOME_HERO_IMAGE_ALT =
  "سيارة فاخرة أمام معرض روائس لتأجير السيارات";

export const SITE_KEY_HOME_HERO_IMAGE_URL = "home_hero_image_url";
export const SITE_KEY_HOME_HERO_IMAGE_ALT = "home_hero_image_alt";

const ALLOWED_DEFAULT_HERO_URLS = new Set([DEFAULT_HOME_HERO_IMAGE_URL]);

export function isAllowedHomeHeroImageUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  if (ALLOWED_DEFAULT_HERO_URLS.has(u)) return true;
  return isTrustedSpacesImageUrl(u);
}

export type HomeHeroSettings = {
  imageUrl: string;
  imageAlt: string;
};

const HOME_HERO_SETTING_KEYS = [SITE_KEY_HOME_HERO_IMAGE_URL, SITE_KEY_HOME_HERO_IMAGE_ALT];

const DEFAULT_HOME_HERO_SETTINGS: HomeHeroSettings = {
  imageUrl: DEFAULT_HOME_HERO_IMAGE_URL,
  imageAlt: DEFAULT_HOME_HERO_IMAGE_ALT,
};

export async function getHomeHeroSettings(): Promise<HomeHeroSettings> {
  try {
    const rows = await prisma.siteSetting.findMany({
      where: { key: { in: HOME_HERO_SETTING_KEYS } },
      select: { key: true, value: true },
    });
    const settings = new Map(rows.map((row) => [row.key, row.value]));

    const urlCandidate = settings.get(SITE_KEY_HOME_HERO_IMAGE_URL)?.trim() ?? "";
    const imageUrl = isAllowedHomeHeroImageUrl(urlCandidate)
      ? urlCandidate
      : DEFAULT_HOME_HERO_IMAGE_URL;

    const imageAlt =
      settings.get(SITE_KEY_HOME_HERO_IMAGE_ALT)?.trim() || DEFAULT_HOME_HERO_IMAGE_ALT;

    return { imageUrl, imageAlt };
  } catch (e: unknown) {
    const code =
      e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
    if (code === "P2021" || code === "P2024") {
      return DEFAULT_HOME_HERO_SETTINGS;
    }
    throw e;
  }
}

/* ─── أيقونات وسائل الدفع (صفحة إتمام الدفع) ──────────────── */

export const PAYMENT_ICON_METHODS = ["TABBY", "TAMARA", "CARD", "MADA", "AMKAN", "APPLE_PAY"] as const;
export type PaymentIconMethod = (typeof PAYMENT_ICON_METHODS)[number];

/** المسارات الأصلية في public/ — تبقى افتراضاً مسموحاً حتى لا تختفي الأيقونة قبل أول رفع إداري. */
export const DEFAULT_PAYMENT_ICON_URLS: Record<PaymentIconMethod, string> = {
  TABBY: "/ايقونات خدمات الدفع/Tabby-01.svg",
  TAMARA: "/tamara.png",
  CARD: "/ايقونات خدمات الدفع/Visa_Inc._logo_(2014–2021).svg",
  MADA: "/ايقونات خدمات الدفع/شعار مدى - SVG.svg",
  AMKAN: "/ايقونات خدمات الدفع/شعار إمكان للتمويل - SVG.svg",
  APPLE_PAY: "/ايقونات خدمات الدفع/Apple_Pay_logo.svg",
};

/** يُصدَّر لأن أكشن التحديث الإداري يحتاج نفس مفاتيح القراءة تماماً — لا تكرار للنمط. */
export function paymentIconSettingKey(method: PaymentIconMethod): string {
  return `payment_icon_${method.toLowerCase()}_url`;
}

export function isAllowedPaymentIconUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  if ((Object.values(DEFAULT_PAYMENT_ICON_URLS) as string[]).includes(u)) return true;
  return isTrustedSpacesImageUrl(u);
}

export type PaymentIconUrls = Record<PaymentIconMethod, string>;

export async function getPaymentIconUrls(): Promise<PaymentIconUrls> {
  try {
    const keys = PAYMENT_ICON_METHODS.map(paymentIconSettingKey);
    const rows = await prisma.siteSetting.findMany({
      where: { key: { in: keys } },
      select: { key: true, value: true },
    });
    const settings = new Map(rows.map((row) => [row.key, row.value]));

    const result = {} as PaymentIconUrls;
    for (const method of PAYMENT_ICON_METHODS) {
      const candidate = settings.get(paymentIconSettingKey(method))?.trim() ?? "";
      result[method] = isAllowedPaymentIconUrl(candidate)
        ? candidate
        : DEFAULT_PAYMENT_ICON_URLS[method];
    }
    return result;
  } catch (e: unknown) {
    const code =
      e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
    if (code === "P2021" || code === "P2024") {
      return { ...DEFAULT_PAYMENT_ICON_URLS };
    }
    throw e;
  }
}

export const SITE_KEY_RENTAL_PRICE_DISPLAY = "rental_price_display";

/** نص سياسات الإلغاء المعروض للعميل عند تأكيد «إزالة الحجز» في حسابه (يحرره المسؤول). */
export const SITE_KEY_CUSTOMER_CANCELLATION_POLICY_AR =
  "customer_cancellation_policy_ar";

/**
 * أقل عدد ساعات قبل موعد الاستلام يسمح للعميل بإلغاء الحجز من الحساب (٠ = بدون تقييد زمني).
 * يُخزَّن كرقم صحيح في نص الإعداد.
 */
export const SITE_KEY_CUSTOMER_CANCEL_MIN_HOURS_BEFORE_PICKUP =
  "customer_cancel_min_hours_before_pickup";

/** JSON: مصفوفة شرائح خصم الأيام عند الإلغاء الذاتي (انظر `lib/cancellation-deduct.ts`). */
export const SITE_KEY_CUSTOMER_CANCELLATION_DEDUCT_TIERS_JSON =
  "customer_cancellation_deduct_tiers_json";

const MAX_CANCEL_DEADLINE_HOURS = 720;

export async function getCustomerCancelMinHoursBeforePickup(): Promise<number> {
  try {
    const row = await prisma.siteSetting.findUnique({
      where: { key: SITE_KEY_CUSTOMER_CANCEL_MIN_HOURS_BEFORE_PICKUP },
      select: { value: true },
    });
    const n = Math.floor(Number(row?.value ?? 0));
    if (!Number.isFinite(n) || n < 0 || n > MAX_CANCEL_DEADLINE_HOURS) return 0;
    return n;
  } catch {
    return 0;
  }
}

export async function getCustomerCancellationDeductTiers(): Promise<CancellationDeductTier[]> {
  try {
    const row = await prisma.siteSetting.findUnique({
      where: { key: SITE_KEY_CUSTOMER_CANCELLATION_DEDUCT_TIERS_JSON },
      select: { value: true },
    });
    return parseCancellationDeductTiersJson(row?.value ?? "");
  } catch {
    return [];
  }
}

/** قناة إرسال رمز التحقق عند إتمام الحجز المباشر (يحددها المسؤول). */
export const SITE_KEY_BOOKING_OTP_CHANNEL = "booking_otp_channel";

export type BookingOtpChannel = "OFF" | "SMS" | "EMAIL" | "WHATSAPP";

const BOOKING_OTP_CHANNELS = new Set<BookingOtpChannel>(["OFF", "SMS", "EMAIL", "WHATSAPP"]);

export function bookingOtpChannelUsesPhone(channel: BookingOtpChannel): boolean {
  return channel === "SMS" || channel === "WHATSAPP";
}

export function parseBookingOtpChannel(raw: string | null | undefined): BookingOtpChannel {
  const s = String(raw ?? "")
    .trim()
    .toUpperCase();
  if (BOOKING_OTP_CHANNELS.has(s as BookingOtpChannel)) {
    return s as BookingOtpChannel;
  }
  return "OFF";
}

export async function getBookingOtpChannel(): Promise<BookingOtpChannel> {
  try {
    const row = await prisma.siteSetting.findUnique({
      where: { key: SITE_KEY_BOOKING_OTP_CHANNEL },
      select: { value: true },
    });
    return parseBookingOtpChannel(row?.value);
  } catch (e) {
    console.error("[getBookingOtpChannel] قراءة إعداد القناة فشلت:", e);
    return "OFF";
  }
}

export const SITE_KEY_BOOKING_WIDGET_TABS = "booking_widget_tabs_v1";

export async function getBookingWidgetTabFlags(): Promise<BookingWidgetTabFlags> {
  try {
    const row = await prisma.siteSetting.findUnique({
      where: { key: SITE_KEY_BOOKING_WIDGET_TABS },
      select: { value: true },
    });
    if (!row?.value?.trim()) {
      return DEFAULT_BOOKING_WIDGET_TAB_FLAGS;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.value) as unknown;
    } catch {
      return DEFAULT_BOOKING_WIDGET_TAB_FLAGS;
    }
    return normalizeBookingWidgetTabFlags(parsed);
  } catch {
    return DEFAULT_BOOKING_WIDGET_TAB_FLAGS;
  }
}

export const SITE_KEY_CHECKOUT_PAYMENT_METHODS = "checkout_payment_methods_v1";

export async function getCheckoutPaymentMethodFlags(): Promise<CheckoutPaymentMethodFlags> {
  try {
    const row = await prisma.siteSetting.findUnique({
      where: { key: SITE_KEY_CHECKOUT_PAYMENT_METHODS },
      select: { value: true },
    });
    if (!row?.value?.trim()) {
      return DEFAULT_CHECKOUT_PAYMENT_METHOD_FLAGS;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(row.value) as unknown;
    } catch {
      return DEFAULT_CHECKOUT_PAYMENT_METHOD_FLAGS;
    }
    return normalizeCheckoutPaymentMethodFlags(parsed);
  } catch {
    return DEFAULT_CHECKOUT_PAYMENT_METHOD_FLAGS;
  }
}

/**
 * وضع Apple Pay: مفعّلاً يُعرض زر Apple Pay داخل صفحتنا (Express Checkout)، ومعطّلاً
 * يُحوَّل العميل إلى صفحة جيديا المستضافة مثل مدى والبطاقة.
 *
 * الافتراضي **معطّل**: مكتبة جيديا `geideaCheckout.min.js` بها خطأ يجعل
 * `validateAndgetWallet` تقرأ `expressCheckouts` من كائن إعدادات التاجر بدل كائن
 * الجلسة، فتُرجع null ويفشل تركيب الزر. يُفعَّل هذا المفتاح بعد إصلاح جيديا للمكتبة
 * وتسجيل نطاقنا لدى Apple — دون أي تعديل على الكود.
 */
export const SITE_KEY_APPLE_PAY_EXPRESS = "apple_pay_express_enabled";

export async function getApplePayExpressEnabled(): Promise<boolean> {
  try {
    const row = await prisma.siteSetting.findUnique({
      where: { key: SITE_KEY_APPLE_PAY_EXPRESS },
      select: { value: true },
    });
    return row?.value?.trim() === "true";
  } catch {
    return false;
  }
}

export async function getRentalPriceDisplayMode(): Promise<RentalPriceDisplayMode> {
  try {
    const row = await prisma.siteSetting.findUnique({
      where: { key: SITE_KEY_RENTAL_PRICE_DISPLAY },
      select: { value: true },
    });
    return parseRentalPriceDisplayMode(row?.value);
  } catch {
    return "EX_TAX";
  }
}

/** نص سياسات الإلغاء للعميل (فارغ إن لم يُضبط بعد). */
export async function getCustomerCancellationPolicyAr(): Promise<string> {
  try {
    const row = await prisma.siteSetting.findUnique({
      where: { key: SITE_KEY_CUSTOMER_CANCELLATION_POLICY_AR },
      select: { value: true },
    });
    return (row?.value ?? "").trim();
  } catch {
    return "";
  }
}
