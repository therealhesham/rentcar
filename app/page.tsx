import {
  BranchesShowcase,
  FleetBanner,
  FleetCategories,
  Hero,
  PromoBanner,
  ServicesSection,
  SiteFooter,
  TopNav,
} from "@/components/home";
import { getActiveBookingCitiesWithBranches } from "@/lib/branch-data";
import { getHomeHeroSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export default async function Home() {
  const hero = await getHomeHeroSettings();
  const cities = await getActiveBookingCitiesWithBranches().catch(() => []);

  return (
    <div className="flex min-h-screen flex-col">
      <TopNav />
      <main className="flex-1">
        <Hero
          leftImageUrl={hero.leftImageUrl}
          leftImageAlt={hero.leftImageAlt}
          rightImageUrl={hero.rightImageUrl}
          rightImageAlt={hero.rightImageAlt}
          cities={cities}
        />
        <FleetCategories />

        <PromoBanner />
        <ServicesSection />
        <BranchesShowcase />
      </main>
      <SiteFooter />
    </div>
  );
}
