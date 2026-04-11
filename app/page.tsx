import {
  BranchesShowcase,
  FleetCategories,
  FleetShowcase,
  Hero,
  SiteFooter,
  TopNav,
} from "@/components/home";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <TopNav />
      <main className="flex-1">
        <Hero />
        <FleetCategories />
        <BranchesShowcase />
        <FleetShowcase />
      </main>
      <SiteFooter />
    </div>
  );
}
