import { getTranslations } from "next-intl/server";
import { SiteNav } from "@/components/shared/SiteNav";
import { SiteFooter } from "@/components/home/SiteFooter";
import { JsonLd } from "@/components/seo/JsonLd";
import { breadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";
import { getPrivacyPolicyContent, localizePrivacyPolicy } from "@/lib/site-settings";

// النص يُحرَّر من لوحة التحكم — نقرأه مع كل طلب حتى يظهر التعديل فوراً.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "PrivacyPolicyPage" });

  return buildPageMetadata({
    title: t("title"),
    description: t("description"),
    path: "/privacy-policy",
  });
}

/** يقسّم النص المكتوب في اللوحة لفقرات — السطر الفارغ يفصل فقرة عن التالية. */
function toParagraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map((p) => p.trim())
    .filter(Boolean);
}

export default async function PrivacyPolicyPage({
  params,
}: {
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await params;
  const t = await getTranslations("PrivacyPolicyPage");
  const navT = await getTranslations("SiteNav");

  const content = await getPrivacyPolicyContent();
  const paragraphs = toParagraphs(localizePrivacyPolicy(content, locale));

  return (
    <div className="flex min-h-screen flex-col bg-surface text-on-surface">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: navT("home"), path: "/" },
          { name: t("title"), path: "/privacy-policy" },
        ])}
      />
      <SiteNav active="none" />

      <header className="relative flex min-h-[30vh] items-center justify-center overflow-hidden bg-[#003749] pt-16 sm:pt-20">
        <div className="relative z-10 px-4 py-12 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
            {t("title")}
          </h1>
          <p className="mt-3 text-sm font-medium text-white/80 sm:text-base">
            {t("description")}
          </p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-[#dbb878]" aria-hidden />
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-14 sm:px-8 sm:py-20">
        {paragraphs.length > 0 ? (
          <div className="space-y-5">
            {paragraphs.map((p, i) => (
              <p
                key={i}
                className="whitespace-pre-line text-sm leading-loose text-on-surface-variant sm:text-base"
              >
                {p}
              </p>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-outline bg-white/70 p-8 text-center text-sm text-on-surface-variant">
            {t("empty")}
          </div>
        )}
      </main>

      <SiteFooter />
    </div>
  );
}
