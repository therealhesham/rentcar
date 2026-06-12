import { buildPageMetadata } from "@/lib/seo";

export const metadata = buildPageMetadata({
  title: "حسابي",
  description: "منطقة العملاء — إدارة الحجوزات والاشتراكات.",
  noIndex: true,
});

export default function AccountLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
