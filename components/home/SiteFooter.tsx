"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { useSiteBranding } from "@/components/shared/SiteBrandingProvider";
import { footerLogoUrl } from "@/lib/site-branding";
import type { SocialPlatformKey } from "@/lib/social-links";
import { RentalTermsModal } from "@/components/fleet/RentalTermsModal";
import { fetchActiveRentalTerms } from "@/app/rental-terms-actions";
import type { RentalTermDTO } from "@/lib/rental-terms-data";

function InstagramIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
    </svg>
  );
}

function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M16.6 5.82s.51.5 0 0A4.278 4.278 0 0 1 15.54 3h-3.09v12.4a2.592 2.592 0 0 1-2.59 2.5c-1.42 0-2.6-1.16-2.6-2.6 0-1.72 1.66-3.01 3.37-2.48V9.66c-3.45-.46-6.47 2.22-6.47 5.64 0 3.33 2.76 5.7 5.69 5.7 3.14 0 5.69-2.55 5.69-5.7V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3s-1.88.09-3.24-1.48z" />
    </svg>
  );
}

function SnapchatIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M12.003 2c-3.722 0-5.834 2.545-6.059 5.645-.078 1.077.218 2.062.664 2.893.181.338.257.518.067.755-.262.327-.852.541-1.39.69-.328.09-.646.166-.844.38-.178.192-.12.428.077.587.729.589 1.64.914 2.518 1.139.389.1.536.273.458.647-.2.955-.783 2.53-2.072 3.111-.314.142-.511.378-.403.712.128.397.63.53 1.08.625 1.545.326 3.036.082 4.545-.456.452-.161.795-.16 1.246.002 1.512.538 3.003.782 4.548.455.45-.095.952-.228 1.08-.625.108-.334-.089-.57-.403-.712-1.289-.581-1.872-2.156-2.072-3.111-.078-.374.069-.547.458-.647.878-.225 1.789-.55 2.518-1.139.197-.159.255-.395.077-.587-.198-.214-.516-.29-.844-.38-.538-.149-1.128-.363-1.39-.69-.19-.237-.114-.417.067-.755.446-.831.742-1.816.664-2.893C17.837 4.545 15.725 2 12.003 2z" />
    </svg>
  );
}

function WhatsAppIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-1.157 4.228 4.228-1.109z" />
    </svg>
  );
}

function TwitterIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

function YouTubeIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function FacebookIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
    </svg>
  );
}

function LinkedInIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h14m-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93h2.75M6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37h2.77z" />
    </svg>
  );
}

export const SOCIAL_ICONS: Record<SocialPlatformKey, React.ComponentType<{ className?: string }>> = {
  instagram: InstagramIcon,
  tiktok: TikTokIcon,
  snapchat: SnapchatIcon,
  whatsapp: WhatsAppIcon,
  twitter: TwitterIcon,
  facebook: FacebookIcon,
  youtube: YouTubeIcon,
  linkedin: LinkedInIcon,
};

function getSiteLinks(t: any) {
  return [
    { href: "/", label: t("home") },
    { href: "/fleet", label: t("fleet") },
    { href: "/about", label: t("about") },
    { href: "/contact", label: t("contact") },
    { href: "#", label: t("termsAndConditions"), isTerms: true },
  ];
}

/** خلفية تيل داكنة + شريط ذهبي سفلي (معايير فوتر الموقع) */
const FOOTER_BG = "#003749";
const FOOTER_ACCENT = "#d4b896";
const FOOTER_GOLD = "#dbb878";

function isLinkActive(pathname: string, href: string) {
  if (href === "#" || href.startsWith("#")) return false;
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function SiteFooter() {
  const pathname = usePathname();
  const locale = useLocale();
  const t = useTranslations("Footer");
  const navT = useTranslations("Navigation.siteNav");
  const siteLinks = getSiteLinks(navT);
  const branding = useSiteBranding();
  const logoSrc = footerLogoUrl(branding, locale);

  const [showTermsModal, setShowTermsModal] = useState(false);
  const [terms, setTerms] = useState<RentalTermDTO[]>([]);
  const [loadingTerms, setLoadingTerms] = useState(false);

  const handleOpenTerms = async (e: React.MouseEvent) => {
    e.preventDefault();
    setShowTermsModal(true);
    if (terms.length === 0 && !loadingTerms) {
      setLoadingTerms(true);
      try {
        const fetched = await fetchActiveRentalTerms(locale);
        setTerms(fetched);
      } catch (err) {
        console.error("فشل تحميل الشروط والأحكام:", err);
      } finally {
        setLoadingTerms(false);
      }
    }
  };

  const activeSocialLinks = (branding.socialLinks || []).filter(
    (s) => s.enabled && Boolean(s.url?.trim())
  );

  return (
    <footer className="w-full text-white" style={{ backgroundColor: FOOTER_BG }}>
      <div
        className="h-[3px] w-full bg-gradient-to-r from-transparent via-[#dbb878] to-transparent"
        aria-hidden
      />
      <div className="mx-auto grid max-w-screen-xl grid-cols-1 gap-10 px-5 py-10 text-center sm:px-8 sm:py-14 md:grid-cols-3 md:text-right">
        <div className="flex items-center justify-center md:justify-self-start">
          <Image
            src={logoSrc}
            alt="روائس لتأجير السيارات"
            width={320}
            height={120}
            priority={false}
            className="h-24 w-auto max-w-full object-contain sm:h-28"
            unoptimized={logoSrc.endsWith(".svg") || logoSrc.startsWith("http")}
          />
        </div>

        <div>
          <h4 className="mb-4 text-sm font-bold text-white">{t("usefulLinks")}</h4>
          <ul className="flex flex-wrap justify-center gap-x-5 gap-y-2 md:block md:space-y-2">
            {siteLinks.map((link) => {
              const active = isLinkActive(pathname, link.href);
              if (link.isTerms) {
                return (
                  <li key={link.label}>
                    <button
                      type="button"
                      onClick={handleOpenTerms}
                      className="text-sm text-white transition-colors hover:text-[#dbb878] cursor-pointer"
                    >
                      {link.label}
                    </button>
                  </li>
                );
              }
              return (
                <li key={link.label}>
                  <Link
                    href={link.href}
                    className={`text-sm transition-colors ${active
                      ? "font-bold"
                      : "text-white hover:text-[#dbb878]"
                      }`}
                    style={
                      active
                        ? { color: FOOTER_GOLD }
                        : undefined
                    }
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        <div>
          <h4 className="mb-4 text-sm font-bold text-white">
            {t("followUs")}
          </h4>
          {activeSocialLinks.length > 0 ? (
            <div className="mb-6 inline-flex flex-wrap items-center justify-center gap-4 rounded-full bg-white px-5 py-2.5 shadow-sm">
              {activeSocialLinks.map((s) => {
                const IconComponent = SOCIAL_ICONS[s.platform] || InstagramIcon;
                return (
                  <a
                    key={s.platform}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={s.label || s.platform}
                    title={s.label || s.platform}
                    className="text-neutral-900 transition-all hover:-translate-y-0.5 hover:text-[#a8874f]"
                  >
                    <IconComponent className="h-5 w-5" />
                  </a>
                );
              })}
            </div>
          ) : null}
          <p className="text-sm text-white/90">
            الفرع الرئيسي: المدينة المنورة - حي العريض - طريق الملك عبدالعزيز
          </p>
        </div>
      </div>

      <div
        className="w-full px-4 py-4 text-center text-xs font-medium leading-relaxed text-white"
        style={{ backgroundColor: FOOTER_ACCENT }}
      >
        {t("allRightsReserved")} - Rawaes
      </div>

      <RentalTermsModal
        open={showTermsModal}
        onClose={() => setShowTermsModal(false)}
        terms={terms}
        loading={loadingTerms}
      />
    </footer>
  );
}
