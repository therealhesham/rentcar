import type { Metadata } from "next";
import { FleetCarGrid, FleetFilters } from "@/components/fleet";
import { SiteFooter } from "@/components/home/SiteFooter";
import { SiteNav } from "@/components/shared/SiteNav";
import { getFleetCarsForDisplay } from "@/lib/fleet-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "الأسطول | Rawaes",
  description:
    "مجموعة مختارة من أرقى السيارات للتأجير اليومي مع فلاتر بحث وتجربة كونسيرج.",
};

type FleetPageProps = {
  searchParams?: Promise<{ category?: string }>;
};

export default async function FleetPage({ searchParams }: FleetPageProps) {
  const params = searchParams ? await searchParams : {};
  const categorySlug = params.category?.trim() || undefined;
  const cars = await getFleetCarsForDisplay(categorySlug).catch(() => []);

  return (
    <div className="flex min-h-screen flex-col bg-surface text-on-surface">
      <SiteNav active="fleet" />
      <div className="pt-28">
        <FleetFilters />
        <main className="mx-auto max-w-screen-2xl px-8 py-24">
          <FleetCarGrid cars={cars} />
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}
