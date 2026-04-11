import type { Metadata } from "next";
import { Cairo } from "next/font/google";
import "./globals.css";

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Rawaes | تأجير سيارات فاخرة",
  description:
    "وجهتك الأولى في المملكة لتأجير السيارات الفاخرة وخدمات السفر والكونسيرج.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ar" dir="rtl" className={`light ${cairo.variable}`}>
      <body
        className={`${cairo.className} min-h-full bg-surface text-on-surface antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
