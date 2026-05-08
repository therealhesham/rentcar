import {
  BranchesShowcase,
  FleetCategories,
  Hero,
  ServicesSection,
  SiteFooter,
  TopNav,
} from "@/components/home";
import { getHomeHeroSettings } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export default async function Home() {
  const hero = await getHomeHeroSettings();

  return (
    <div className="flex min-h-screen flex-col">
      <TopNav />
      <main className="flex-1">
        <Hero
          leftImageUrl={hero.leftImageUrl}
          leftImageAlt={hero.leftImageAlt}
          rightImageUrl={hero.rightImageUrl}
          rightImageAlt={hero.rightImageAlt}
        />
        <ServicesSection />
        <FleetCategories />
        <BranchesShowcase />
      </main>
      <SiteFooter />
    </div>
  );
}
