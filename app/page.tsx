import {
  BranchesShowcase,
  FleetCategories,
  FleetShowcase,
  Hero,
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
        <Hero imageUrl={hero.imageUrl} imageAlt={hero.imageAlt} />
        <FleetCategories />
        <BranchesShowcase />
        <FleetShowcase />
      </main>
      <SiteFooter />
    </div>
  );
}
