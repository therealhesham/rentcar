import type { Metadata, Viewport } from "next";
import { Tajawal } from "next/font/google";
import { JsonLd } from "@/components/seo/JsonLd";
import { PageViewTracker } from "@/components/shared/PageViewTracker";
import { SiteBrandingProvider } from "@/components/shared/SiteBrandingProvider";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";

import {
  buildRootLayoutMetadata,
  carRentalJsonLd,
  organizationJsonLd,
  webSiteJsonLd,
} from "@/lib/seo";
import { getSiteBranding } from "@/lib/site-settings";
import "../globals.css";

const tajawal = Tajawal({
  subsets: ["arabic", "latin"],
  weight: ["200", "300", "400", "500", "700", "800", "900"],
  variable: "--font-tajawal",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const branding = await getSiteBranding();
  return {
    ...buildRootLayoutMetadata(branding),
    formatDetection: {
      email: false,
      address: false,
      telephone: false,
    },
  };
}

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#003749",
};

export default async function LocaleLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }> | { locale: string };
}>) {
  // In Next.js 15, params is a Promise. Let's await it.
  const resolvedParams = await params;
  const locale = resolvedParams.locale;

  if (!routing.locales.includes(locale as any)) {
    notFound();
  }

  const messages = await getMessages();
  const dir = locale === "ar" ? "rtl" : "ltr";
  const branding = await getSiteBranding();

  return (
    <html lang={locale} dir={dir} className={`light ${tajawal.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@emran-alhaddad/saudi-riyal-font@1.1.0/index.css"
        />
      </head>
      <body
        className={`${tajawal.className} min-h-full bg-surface text-on-surface antialiased`}
      >
        <NextIntlClientProvider messages={messages}>
          <SiteBrandingProvider value={branding}>
            <JsonLd
              data={[
                organizationJsonLd(branding.ogImage),
                webSiteJsonLd(),
                carRentalJsonLd(),
              ]}
            />
            <PageViewTracker />
            {children}
          </SiteBrandingProvider>
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
