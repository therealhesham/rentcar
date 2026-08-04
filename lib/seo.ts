import type { Metadata } from "next";

export const SITE_NAME_AR = "روائس لتأجير السيارات";
export const SITE_NAME_EN = "Rawaes";
/** اسم مختصر — متوافق مع layout الحالي */
export const SITE_NAME = SITE_NAME_AR;
export const SITE_TAGLINE =
  "تأجير سيارات فاخرة في المملكة العربية السعودية — حجز يومي وأسبوعي وباقات شهرية.";

export const DEFAULT_DESCRIPTION =
  "روائس: تأجير سيارات فاخرة مع حجز أونلاين، فروع في مدن المملكة، توصيل واستلام من الفرع، وباقات اشتراك شهرية.";

export const DEFAULT_KEYWORDS = [
  "تأجير سيارات",
  "تأجير سيارات فاخرة",
  "تأجير سيارات السعودية",
  "روائس",
  "Rawaes",
  "حجز سيارة",
  "اشتراك سيارات",
];

const OG_IMAGE_PATH = "/logo.png";
const FAVICON_PATH = "/logo.ico";

/** عنوان الموقع في `<title>` — يُكمَّل تلقائياً بقالب `%s | روائس` في layout */
export function pageTitle(segment: string): string {
  const t = segment.trim();
  if (!t) return SITE_NAME_AR;
  if (t.includes(SITE_NAME_AR) || t.includes(SITE_NAME_EN)) return t;
  return t;
}

export function getSiteUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/$/, "");
  const vercel = process.env.VERCEL_URL?.trim();
  if (vercel) return `https://${vercel.replace(/^https?:\/\//, "")}`;
  return "http://localhost:3000";
}

export function absoluteUrl(path: string): string {
  const base = getSiteUrl();
  const p = path.startsWith("/") ? path : `/${path}`;
  return `${base}${p}`;
}

export type PageMetadataInput = {
  title: string;
  description?: string;
  /** مسار نسبي مثل `/fleet` لـ canonical و Open Graph url */
  path?: string;
  noIndex?: boolean;
  keywords?: string[];
  ogImage?: string;
};

export function buildPageMetadata(input: PageMetadataInput): Metadata {
  const title = pageTitle(input.title);
  const description = input.description?.trim() || DEFAULT_DESCRIPTION;
  const canonical = input.path ? absoluteUrl(input.path) : undefined;
  const image = absoluteUrl(input.ogImage ?? OG_IMAGE_PATH);
  const keywords = input.keywords ?? DEFAULT_KEYWORDS;

  const robots = input.noIndex
    ? { index: false as const, follow: false as const }
    : {
        index: true as const,
        follow: true as const,
        googleBot: {
          index: true,
          follow: true,
          "max-image-preview": "large" as const,
          "max-snippet": -1,
        },
      };

  return {
    title,
    description,
    keywords,
    alternates: canonical ? { canonical } : undefined,
    robots,
    openGraph: {
      type: "website",
      locale: "ar_SA",
      url: canonical,
      siteName: SITE_NAME_AR,
      title,
      description,
      images: [{ url: image, width: 1200, height: 630, alt: SITE_NAME_AR }],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [image],
    },
  };
}

/**
 * الأيقونة وصورة المشاركة يديرهما الأدمن من «شعارات الموقع»، لذا تُبنى البيانات
 * الوصفية بدالة تستقبل الروابط المحفوظة — والقيم الافتراضية للسياقات التي لا
 * تقرأ من قاعدة البيانات.
 */
export function buildRootLayoutMetadata(
  branding: { favicon: string; ogImage: string } = {
    favicon: FAVICON_PATH,
    ogImage: OG_IMAGE_PATH,
  },
): Metadata {
  return {
    metadataBase: new URL(getSiteUrl()),
    title: {
      default: SITE_NAME_AR,
      template: `%s | ${SITE_NAME_AR}`,
    },
    description: DEFAULT_DESCRIPTION,
    keywords: DEFAULT_KEYWORDS,
    authors: [{ name: SITE_NAME_AR }],
    creator: SITE_NAME_AR,
    publisher: SITE_NAME_AR,
    category: "travel",
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      locale: "ar_SA",
      siteName: SITE_NAME_AR,
      title: SITE_NAME_AR,
      description: DEFAULT_DESCRIPTION,
      images: [{ url: branding.ogImage, alt: SITE_NAME_AR }],
    },
    twitter: {
      card: "summary_large_image",
      title: SITE_NAME_AR,
      description: DEFAULT_DESCRIPTION,
      images: [branding.ogImage],
    },
    icons: {
      icon: branding.favicon,
      apple: branding.ogImage,
    },
  };
}

export const rootLayoutMetadata: Metadata = buildRootLayoutMetadata();

/** مسارات عامة ثابتة للفهرسة */
export const PUBLIC_STATIC_PATHS = [
  "/",
  "/about",
  "/fleet",
  "/subscriptions",
] as const;

export function organizationJsonLd(logoUrl: string = OG_IMAGE_PATH) {
  const url = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME_AR,
    alternateName: SITE_NAME_EN,
    url,
    logo: logoUrl.startsWith("http") ? logoUrl : absoluteUrl(logoUrl),
    description: DEFAULT_DESCRIPTION,
    areaServed: {
      "@type": "Country",
      name: "Saudi Arabia",
    },
  };
}

export function webSiteJsonLd() {
  const url = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME_AR,
    url,
    inLanguage: "ar-SA",
    potentialAction: {
      "@type": "SearchAction",
      target: {
        "@type": "EntryPoint",
        urlTemplate: `${url}/fleet?pickup={search_term_string}`,
      },
      "query-input": "required name=search_term_string",
    },
  };
}

/** اسم قديم — للتوافق */
export const websiteJsonLd = webSiteJsonLd;

export function carRentalJsonLd() {
  const url = getSiteUrl();
  return {
    "@context": "https://schema.org",
    "@type": "AutoRental",
    name: SITE_NAME_AR,
    url,
    image: absoluteUrl("/ourfleet.jpg"),
    description: DEFAULT_DESCRIPTION,
    priceRange: "$$",
    currenciesAccepted: "SAR",
    paymentAccepted: "Cash, Credit Card",
    areaServed: {
      "@type": "Country",
      name: "Saudi Arabia",
    },
  };
}

export function breadcrumbJsonLd(items: Array<{ name: string; path: string }>) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((it, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: it.name,
      item: absoluteUrl(it.path),
    })),
  };
}
