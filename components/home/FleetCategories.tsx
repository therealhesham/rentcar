import { getActiveBookingCitiesWithBranches } from "@/lib/branch-data";
import { getFleetCategoriesForHome } from "@/lib/fleet-category-data";
import { getFleetCarMapByModelIds } from "@/lib/fleet-data";
import { getRentalPriceDisplayMode } from "@/lib/site-settings";
import {
  FleetCategoriesShowcase,
  type FleetCategoryTab,
} from "./FleetCategoriesShowcase";
import { Reveal } from "./HomeMotion";
import { getLocale } from "next-intl/server";

export async function FleetCategories() {
  const categories = await getFleetCategoriesForHome().catch(() => []);

  if (categories.length === 0) {
    return null;
  }

  const allModelIds = categories.flatMap((c) => c.models.map((m) => m.id));
  const priceMode = await getRentalPriceDisplayMode();
  const [carByModel, cities] = await Promise.all([
    getFleetCarMapByModelIds(allModelIds, priceMode),
    getActiveBookingCitiesWithBranches().catch(() => []),
  ]);

  const tabs: FleetCategoryTab[] = categories.map((cat) => ({
    slug: cat.slug,
    tabLabel: cat.title,
    cars: cat.models
      .map((m) => carByModel.get(m.id))
      .filter((car): car is NonNullable<typeof car> => car != null),
  }));

  return (
    <section
      id="fleet-categories"
      className="relative overflow-hidden bg-[#fafafa] py-12 text-on-surface sm:py-28"
      dir={await getLocale() === "ar" ? "rtl" : "ltr"}
      aria-labelledby="fleet-categories-heading"
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "radial-gradient(circle, #003749 1.25px, transparent 1.25px)",
          backgroundSize: "24px 24px",
        }}
      />
      <div className="pointer-events-none absolute -start-[16rem] top-0 h-[32rem] w-[32rem] rounded-full bg-gradient-to-tr from-[#dbb878]/14 to-transparent blur-3xl" />
      <div className="pointer-events-none absolute -end-[16rem] bottom-0 h-[32rem] w-[32rem] rounded-full bg-gradient-to-bl from-[#003749]/10 to-transparent blur-3xl" />

      <Reveal className="relative z-[1]">
        <FleetCategoriesShowcase tabs={tabs} cities={cities} />
      </Reveal>
    </section>
  );
}
