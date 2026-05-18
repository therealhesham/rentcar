import {
  BranchesShowcase,
  FleetCategories,
  Hero,
  HomeScrollSections,
  PromoBanner,
  ServicesSection,
  SiteFooter,
  TopNav,
} from "@/components/home";
import { getActiveBookingCitiesWithBranches } from "@/lib/branch-data";
import { getBookingWidgetTabFlags, getHomeHeroSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export default async function Home() {
  const [hero, cities, tabFlags] = await Promise.all([
    getHomeHeroSettings(),
    getActiveBookingCitiesWithBranches().catch(() => []),
    getBookingWidgetTabFlags(),
  ]);

  return (
    <div className="flex min-h-screen flex-col overflow-x-clip">
      <TopNav />
      <main className="flex-1 overflow-x-clip">
        <HomeScrollSections
          hero={
            <Hero
              leftImageUrl={hero.leftImageUrl}
              leftImageAlt={hero.leftImageAlt}
              rightImageUrl={hero.rightImageUrl}
              rightImageAlt={hero.rightImageAlt}
              cities={cities}
              tabFlags={tabFlags}
            />
          }
          fleetCategories={<FleetCategories />}
          promoBanner={<PromoBanner />}
          services={<ServicesSection />}
          branches={<BranchesShowcase />}
        />
      </main>
      <SiteFooter />
    </div>
  );
}
