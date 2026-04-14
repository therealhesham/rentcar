import { prisma } from "@/lib/prisma";
import { isTrustedSpacesImageUrl } from "@/lib/spaces-upload";

/** صورة الهيرو الافتراضية عند عدم وجود قيمة في قاعدة البيانات */
export const DEFAULT_HOME_HERO_IMAGE_URL =
  "https://lh3.googleusercontent.com/aida-public/AB6AXuD_wHp6ORrYsBkgi0UyOM9QPOZM5bDcBfhhiqFUAWIi_pRppfkX3yuO9YkH7lRHPQn0zMBLvBo77J3n-avrqC22bLvZ71W4X4QAFO6YqbuEJtNyFdOIgtj8yWTFS5AkpYAADSaZIePszEqX3bSF4-QdK92ONP57oeRSrrsiQ_SQu0Z0EXEoRFknm0KQUTN9WyJSd9H9sm_nfmeIVaY9ud5JaTpCFqXlwGaNLIvs-RFTOJcu-EAu_w31N9dPlt3mVhqd6YyUdFRk3Y6M";

export const DEFAULT_HOME_HERO_IMAGE_ALT =
  "سيارة بورش فاخرة على طريق ساحلي عند غروب الشمس";

export const SITE_KEY_HOME_HERO_IMAGE_URL = "home_hero_image_url";
export const SITE_KEY_HOME_HERO_IMAGE_ALT = "home_hero_image_alt";

export function isAllowedHomeHeroImageUrl(url: string): boolean {
  const u = url.trim();
  if (!u) return false;
  if (u === DEFAULT_HOME_HERO_IMAGE_URL) return true;
  return isTrustedSpacesImageUrl(u);
}

export async function getHomeHeroSettings(): Promise<{
  imageUrl: string;
  imageAlt: string;
}> {
  try {
    const [urlRow, altRow] = await Promise.all([
      prisma.siteSetting.findUnique({
        where: { key: SITE_KEY_HOME_HERO_IMAGE_URL },
        select: { value: true },
      }),
      prisma.siteSetting.findUnique({
        where: { key: SITE_KEY_HOME_HERO_IMAGE_ALT },
        select: { value: true },
      }),
    ]);

    const imageUrlCandidate = urlRow?.value?.trim() ?? "";
    const imageUrl = isAllowedHomeHeroImageUrl(imageUrlCandidate)
      ? imageUrlCandidate
      : DEFAULT_HOME_HERO_IMAGE_URL;

    const alt = altRow?.value?.trim() || DEFAULT_HOME_HERO_IMAGE_ALT;

    return { imageUrl, imageAlt: alt };
  } catch (e: unknown) {
    const code =
      e && typeof e === "object" && "code" in e ? String((e as { code: string }).code) : "";
    if (code === "P2021") {
      return {
        imageUrl: DEFAULT_HOME_HERO_IMAGE_URL,
        imageAlt: DEFAULT_HOME_HERO_IMAGE_ALT,
      };
    }
    throw e;
  }
}
