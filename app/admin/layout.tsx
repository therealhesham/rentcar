import type { Metadata, Viewport } from "next";
import { Cairo } from "next/font/google";
import { JsonLd } from "@/components/seo/JsonLd";
import {
  buildRootLayoutMetadata,
  carRentalJsonLd,
  organizationJsonLd,
  webSiteJsonLd,
} from "@/lib/seo";
import { getSiteBranding } from "@/lib/site-settings";
import "../globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
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

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={`light ${cairo.variable}`}>
      <head>
        <link
          rel="stylesheet"
          href="https://cdn.jsdelivr.net/npm/@emran-alhaddad/saudi-riyal-font@1.1.0/index.css"
        />
      </head>
      <body
        className={`${cairo.className} min-h-full bg-surface text-on-surface antialiased`}
      >
        <JsonLd
          data={[organizationJsonLd(), webSiteJsonLd(), carRentalJsonLd()]}
        />
        {children}
      </body>
    </html>
  );
}
