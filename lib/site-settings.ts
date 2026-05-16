import { prisma } from "@/lib/prisma";
import {
  DEFAULT_BOOKING_WIDGET_TAB_FLAGS,
  normalizeBookingWidgetTabFlags,
  type BookingWidgetTabFlags,
} from "@/lib/booking-widget-tabs";
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

/** صورة الهيرو الافتراضية (قديمة — للتوافق مع الروابط المحفوظة) */
export const DEFAULT_HOME_HERO_IMAGE_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuD_wHp6ORrYsBkgi0UyOM9QPOZM5bDcBfhhiqFUAWIi_pRppfkX3yuO9YkH7lRHPQn0zMBLvBo77J3n-avrqC22bLvZ71W4X4QAFO6YqbuEJtNyFdOIgtj8yWTFS5AkpYAADSaZIePszEqX3bSF4-QdK92ONP57oeRSrrsiQ_SQu0Z0EXEoRFknm0KQUTN9WyJSd9H9sm_nfmeIVaY9ud5JaTpCFqXlwGaNLIvs-RFTOJcu-EAu_w31N9dPlt3mVhqd6YyUdFRk3Y6M";

export const DEFAULT_HOME_HERO_IMAGE_ALT =
  "سيارة بورش فاخرة على طريق ساحلي عند غروب الشمس";

export const DEFAULT_HOME_HERO_LEFT_IMAGE_URL =
  "https://images.unsplash.com/photo-1489821584143-984f940e1256?auto=format&fit=crop&w=1200&q=80";

export const DEFAULT_HOME_HERO_LEFT_IMAGE_ALT = "صف من السيارات أمام مبنى حديث";

export const DEFAULT_HOME_HERO_RIGHT_IMAGE_URL =
  "https://images.unsplash.com/photo-1617814076367-b759c7d7e738?auto=format&fit=crop&w=1200&q=80";

export const DEFAULT_HOME_HERO_RIGHT_IMAGE_ALT = "معرض سيارات فاخرة من الداخل";

export const SITE_KEY_HOME_HERO_IMAGE_URL = "home_hero_image_url";
export const SITE_KEY_HOME_HERO_IMAGE_ALT = "home_hero_image_alt";
export const SITE_KEY_HOME_HERO_LEFT_IMAGE_URL = "home_hero_left_image_url";
export const SITE_KEY_HOME_HERO_LEFT_IMAGE_ALT = "home_hero_left_image_alt";
export const SITE_KEY_HOME_HERO_RIGHT_IMAGE_URL = "home_hero_right_image_url";
export const SITE_KEY_HOME_HERO_RIGHT_IMAGE_ALT = "home_hero_right_image_alt";

const ALLOWED_DEFAULT_HERO_URLS = new Set([
  DEFAULT_HOME_HERO_IMAGE_URL,
  DEFAULT_HOME_HERO_LEFT_IMAGE_URL,
  DEFAULT_HOME_HERO_RIGHT_IMAGE_URL,
]);

export function isAllowedHomeHeroImageUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  if (ALLOWED_DEFAULT_HERO_URLS.has(u)) return true;
  return isTrustedSpacesImageUrl(u);
}

export type HomeHeroSettings = {
  leftImageUrl: string;
  leftImageAlt: string;
  rightImageUrl: string;
  rightImageAlt: string;
};

const HOME_HERO_SETTING_KEYS = [
  SITE_KEY_HOME_HERO_IMAGE_URL,
  SITE_KEY_HOME_HERO_IMAGE_ALT,
  SITE_KEY_HOME_HERO_LEFT_IMAGE_URL,
  SITE_KEY_HOME_HERO_LEFT_IMAGE_ALT,
  SITE_KEY_HOME_HERO_RIGHT_IMAGE_URL,
  SITE_KEY_HOME_HERO_RIGHT_IMAGE_ALT,
];

const DEFAULT_HOME_HERO_SETTINGS: HomeHeroSettings = {
  leftImageUrl: DEFAULT_HOME_HERO_LEFT_IMAGE_URL,
  leftImageAlt: DEFAULT_HOME_HERO_LEFT_IMAGE_ALT,
  rightImageUrl: DEFAULT_HOME_HERO_RIGHT_IMAGE_URL,
  rightImageAlt: DEFAULT_HOME_HERO_RIGHT_IMAGE_ALT,
};

export async function getHomeHeroSettings(): Promise<HomeHeroSettings> {
  try {
    const rows = await prisma.siteSetting.findMany({
      where: { key: { in: HOME_HERO_SETTING_KEYS } },
      select: { key: true, value: true },
    });
    const settings = new Map(rows.map((row) => [row.key, row.value]));

    const legacyUrlCandidate =
      settings.get(SITE_KEY_HOME_HERO_IMAGE_URL)?.trim() ?? "";
    const legacyUrl = isAllowedHomeHeroImageUrl(legacyUrlCandidate)
      ? legacyUrlCandidate
      : "";

    const legacyAlt = settings.get(SITE_KEY_HOME_HERO_IMAGE_ALT)?.trim() || "";

    const leftUrlCandidate =
      settings.get(SITE_KEY_HOME_HERO_LEFT_IMAGE_URL)?.trim() ?? "";
    const rightUrlCandidate =
      settings.get(SITE_KEY_HOME_HERO_RIGHT_IMAGE_URL)?.trim() ?? "";

    const leftImageUrl = isAllowedHomeHeroImageUrl(leftUrlCandidate)
      ? leftUrlCandidate
      : legacyUrl || DEFAULT_HOME_HERO_LEFT_IMAGE_URL;

    const rightImageUrl = isAllowedHomeHeroImageUrl(rightUrlCandidate)
      ? rightUrlCandidate
      : legacyUrl || DEFAULT_HOME_HERO_RIGHT_IMAGE_URL;

    const leftImageAlt =
      settings.get(SITE_KEY_HOME_HERO_LEFT_IMAGE_ALT)?.trim() ||
      legacyAlt ||
      DEFAULT_HOME_HERO_LEFT_IMAGE_ALT;
    const rightImageAlt =
      settings.get(SITE_KEY_HOME_HERO_RIGHT_IMAGE_ALT)?.trim() ||
      legacyAlt ||
      DEFAULT_HOME_HERO_RIGHT_IMAGE_ALT;

    return { leftImageUrl, leftImageAlt, rightImageUrl, rightImageAlt };
  } catch (e: unknown) {
    const code =
      e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
    if (code === "P2021" || code === "P2024") {
      return DEFAULT_HOME_HERO_SETTINGS;
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
