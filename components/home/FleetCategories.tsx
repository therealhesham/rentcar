import { getFleetCategoriesForHome } from "@/lib/fleet-category-data";
import {
  FleetCategoriesShowcase,
  type FleetCategoryTab,
} from "./FleetCategoriesShowcase";
import { Reveal } from "./HomeMotion";

function luggageLabelForChairs(chairs: number): string {
  if (chairs >= 7) return "حتى 4 حقائب سفر تقريباً";
  if (chairs >= 5) return "حتى 3 حقائب سفر تقريباً";
  return "حقيبتان–ثلاث تقريباً";
}

export async function FleetCategories() {
  const categories = await getFleetCategoriesForHome().catch(() => []);

  if (categories.length === 0) {
    return null;
  }

  const tabs: FleetCategoryTab[] = categories.map((cat) => ({
    slug: cat.slug,
    tabLabel: cat.title,
    cards:
      cat.models.length > 0
        ? cat.models.map((m) => ({
            id: `m-${m.id}`,
            eyebrow: cat.title,
            detailLine: `${m.brand.name} ${m.name} — أو مشابه`,
            image: m.image?.trim() || cat.image,
            alt: m.alt?.trim() || `${m.brand.name} ${m.name}`,
            seats: m.chairs,
            luggageLabel: luggageLabelForChairs(m.chairs),
          }))
        : [],
  }));

  return (
    <section
      id="fleet-categories"
      className="relative overflow-hidden bg-[#fafafa] py-20 text-on-surface sm:py-28"
      dir="rtl"
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
        <FleetCategoriesShowcase tabs={tabs} />
      </Reveal>
    </section>
  );
}
