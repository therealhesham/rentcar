import { prisma } from "@/lib/prisma";
import { isTrustedSpacesImageUrl } from "@/lib/spaces-upload";

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

export async function getHomeHeroSettings(): Promise<HomeHeroSettings> {
  try {
    const [
      legacyUrlRow,
      legacyAltRow,
      leftUrlRow,
      leftAltRow,
      rightUrlRow,
      rightAltRow,
    ] = await Promise.all([
      prisma.siteSetting.findUnique({
        where: { key: SITE_KEY_HOME_HERO_IMAGE_URL },
        select: { value: true },
      }),
      prisma.siteSetting.findUnique({
        where: { key: SITE_KEY_HOME_HERO_IMAGE_ALT },
        select: { value: true },
      }),
      prisma.siteSetting.findUnique({
        where: { key: SITE_KEY_HOME_HERO_LEFT_IMAGE_URL },
        select: { value: true },
      }),
      prisma.siteSetting.findUnique({
        where: { key: SITE_KEY_HOME_HERO_LEFT_IMAGE_ALT },
        select: { value: true },
      }),
      prisma.siteSetting.findUnique({
        where: { key: SITE_KEY_HOME_HERO_RIGHT_IMAGE_URL },
        select: { value: true },
      }),
      prisma.siteSetting.findUnique({
        where: { key: SITE_KEY_HOME_HERO_RIGHT_IMAGE_ALT },
        select: { value: true },
      }),
    ]);

    const legacyUrlCandidate = legacyUrlRow?.value?.trim() ?? "";
    const legacyUrl = isAllowedHomeHeroImageUrl(legacyUrlCandidate)
      ? legacyUrlCandidate
      : "";

    const legacyAlt = legacyAltRow?.value?.trim() || "";

    const leftUrlCandidate = leftUrlRow?.value?.trim() ?? "";
    const rightUrlCandidate = rightUrlRow?.value?.trim() ?? "";

    const leftImageUrl = isAllowedHomeHeroImageUrl(leftUrlCandidate)
      ? leftUrlCandidate
      : legacyUrl || DEFAULT_HOME_HERO_LEFT_IMAGE_URL;

    const rightImageUrl = isAllowedHomeHeroImageUrl(rightUrlCandidate)
      ? rightUrlCandidate
      : legacyUrl || DEFAULT_HOME_HERO_RIGHT_IMAGE_URL;

    const leftImageAlt =
      leftAltRow?.value?.trim() || legacyAlt || DEFAULT_HOME_HERO_LEFT_IMAGE_ALT;
    const rightImageAlt =
      rightAltRow?.value?.trim() || legacyAlt || DEFAULT_HOME_HERO_RIGHT_IMAGE_ALT;

    return { leftImageUrl, leftImageAlt, rightImageUrl, rightImageAlt };
  } catch (e: unknown) {
    const code =
      e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
    if (code === "P2021") {
      return {
        leftImageUrl: DEFAULT_HOME_HERO_LEFT_IMAGE_URL,
        leftImageAlt: DEFAULT_HOME_HERO_LEFT_IMAGE_ALT,
        rightImageUrl: DEFAULT_HOME_HERO_RIGHT_IMAGE_URL,
        rightImageAlt: DEFAULT_HOME_HERO_RIGHT_IMAGE_ALT,
      };
    }
    throw e;
  }
}
