/**
 * شعارات الموقع (الهيدر/الفوتر/الأيقونة) — تعريفات خالصة بلا Prisma حتى تُستورد
 * من مكوّنات العميل أيضاً. القراءة من قاعدة البيانات في `lib/site-settings.ts`.
 *
 * لكل من الهيدر والفوتر نسخة عربية وأخرى إنجليزية لأن الشعار نفسه يختلف شكلاً
 * باختلاف اللغة، بينما الأيقونة وصورة المشاركة (OG) نسخة واحدة لكل الموقع.
 */

import { DEFAULT_SOCIAL_LINKS, type SocialLinkItem } from "@/lib/social-links";

export const SITE_BRANDING_SLOTS = [
  "navAr",
  "navEn",
  "footerAr",
  "footerEn",
  "sidebarLogo",
  "favicon",
  "ogImage",
] as const;

export type SiteBrandingSlot = (typeof SITE_BRANDING_SLOTS)[number];

export type SiteBranding = Record<SiteBrandingSlot, string> & {
  socialLinks: SocialLinkItem[];
};

/** المسارات الأصلية في public/ — تبقى افتراضاً مسموحاً حتى لا يختفي الشعار قبل أول رفع إداري. */
export const DEFAULT_SITE_BRANDING: SiteBranding = {
  navAr: "/logo.avif",
  navEn: "/logo.svg",
  footerAr: "/footerlogo.svg",
  footerEn: "/ss.svg",
  sidebarLogo: "/logo.avif",
  favicon: "/logo.ico",
  ogImage: "/logo.png",
  socialLinks: DEFAULT_SOCIAL_LINKS,
};

/** مفاتيح SiteSetting — يُصدَّر لأن أكشن التحديث الإداري يحتاج نفس مفاتيح القراءة تماماً. */
export const SITE_BRANDING_SETTING_KEYS: Record<SiteBrandingSlot, string> = {
  navAr: "site_logo_nav_ar_url",
  navEn: "site_logo_nav_en_url",
  footerAr: "site_logo_footer_ar_url",
  footerEn: "site_logo_footer_en_url",
  sidebarLogo: "site_logo_sidebar_url",
  favicon: "site_favicon_url",
  ogImage: "site_og_image_url",
};

export const SITE_BRANDING_SLOT_LABELS_AR: Record<SiteBrandingSlot, string> = {
  navAr: "شعار الهيدر — العربية",
  navEn: "شعار الهيدر — الإنجليزية",
  footerAr: "شعار الفوتر — العربية",
  footerEn: "شعار الفوتر — الإنجليزية",
  sidebarLogo: "شعار السايدبار (لوحة الإدارة والقوائم)",
  favicon: "أيقونة المتصفح (favicon)",
  ogImage: "صورة المشاركة (OG)",
};

/** اللغة الوحيدة التي لها شعار خاص غير العربي — أي لغة أخرى تعود للنسخة العربية. */
function isEnglish(locale: string): boolean {
  return locale.toLowerCase().startsWith("en");
}

export function navLogoUrl(branding: SiteBranding, locale: string): string {
  const isEn = isEnglish(locale);
  if (isEn) {
    return branding.navEn || branding.navAr || DEFAULT_SITE_BRANDING.navEn;
  }
  return branding.navAr || DEFAULT_SITE_BRANDING.navAr;
}

export function footerLogoUrl(branding: SiteBranding, locale: string): string {
  const isEn = isEnglish(locale);
  if (isEn) {
    return branding.footerEn || branding.footerAr || DEFAULT_SITE_BRANDING.footerEn;
  }
  return branding.footerAr || DEFAULT_SITE_BRANDING.footerAr;
}

export function sidebarLogoUrl(branding: SiteBranding): string {
  return branding.sidebarLogo || branding.navAr || DEFAULT_SITE_BRANDING.sidebarLogo;
}
