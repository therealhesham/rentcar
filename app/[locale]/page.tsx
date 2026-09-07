import {
  BranchesShowcase,
  FleetBanner,
  FleetCategories,
  FloatingBookCta,
  Hero,
  HomeCtaSection,
  HomeScrollSections,
  PromoBanner,
  PromoModal,
  ServicesSection,
  SiteFooter,
  TopNav,
} from "@/components/home";
import { getActiveBookingCitiesWithBranches } from "@/lib/branch-data";
import { buildPageMetadata } from "@/lib/seo";
import {
  getBookingWidgetTabFlags,
  getHomeHeroSettings,
  getPromoModalSettings,
} from "@/lib/site-settings";
import { getTranslations } from "next-intl/server";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> | { locale: string } }) {
  const resolvedParams = await params;
  const t = await getTranslations({ locale: resolvedParams.locale, namespace: "HomePage" });

  return buildPageMetadata({
    title: t("title"),
    description: t("description"),
    path: "/",
    ogImage: "/ourfleet.jpg",
  });
}

export default async function Home({
  params,
  searchParams,
}: {
  params: Promise<{ locale: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { locale } = await params;
  // تبويب الإيجار في الويدجت يكتب `?rental=` — لتتحدّث أسعار بطاقات الأسطول تحته
  const rentalRaw = (await searchParams).rental;
  const rentalTab = Array.isArray(rentalRaw) ? rentalRaw[0] : rentalRaw;
  const [hero, cities, tabFlags, promoModal] = await Promise.all([
    getHomeHeroSettings(),
    getActiveBookingCitiesWithBranches(locale).catch(() => []),
    getBookingWidgetTabFlags(),
    getPromoModalSettings(),
  ]);

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <TopNav />
      <main className="flex-1 overflow-x-clip">
        <HomeScrollSections
          hero={
            <Hero
              slides={hero.slides}
              colors={hero.colors}
              cities={cities}
              tabFlags={tabFlags}
              initialRental={rentalTab}
            />
          }
          fleetCategories={<FleetCategories rentalTab={rentalTab} />}
          promoBanner={<PromoBanner />}
          services={<ServicesSection />}
          fleetBanner={<FleetBanner />}
          branches={<BranchesShowcase />}
          homeCta={<HomeCtaSection />}
        />
        <FloatingBookCta />
      </main>
      {promoModal.enabled && promoModal.slides.length > 0 && (
        <PromoModal
          slides={promoModal.slides}
          cooldownMinutes={promoModal.cooldownMinutes}
          locale={locale}
        />
      )}
      <SiteFooter />
    </div>
  );
}
