import { prisma } from "@/lib/prisma";
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
