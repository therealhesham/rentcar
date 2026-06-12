import type { Viewport } from "next";
import { Cairo } from "next/font/google";
import { JsonLd } from "@/components/seo/JsonLd";
import { NextIntlClientProvider } from "next-intl";
import { getMessages } from "next-intl/server";
import { notFound } from "next/navigation";
import { routing } from "@/i18n/routing";

import {
  carRentalJsonLd,
  organizationJsonLd,
  rootLayoutMetadata,
  webSiteJsonLd,
} from "@/lib/seo";
import "../globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
});

export const metadata = {
  ...rootLayoutMetadata,
  formatDetection: {
    email: false,
    address: false,
    telephone: false,
  },
};

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

  return (
    <html lang={locale} dir={dir} className={`light ${cairo.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@emran-alhaddad/saudi-riyal-font@1.1.0/index.css"
        />
      </head>
      <body
        className={`${cairo.className} min-h-full bg-surface text-on-surface antialiased`}
      >
        <NextIntlClientProvider messages={messages}>
          <JsonLd
            data={[organizationJsonLd(), webSiteJsonLd(), carRentalJsonLd()]}
          />
          {children}
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
