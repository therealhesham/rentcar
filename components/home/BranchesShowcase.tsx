import { getActiveBranches, getNewBranchesForHome } from "@/lib/branch-data";
import { Reveal } from "./HomeMotion";
import { getLocale, getTranslations } from "next-intl/server";
import {
  BranchesMapExplorer,
  type ExplorerBranch,
  type ExplorerCityGroup,
} from "./BranchesMapExplorer";

type BranchWithCity = ExplorerBranch & {
  city: { id: number; name: string; slug: string; sortOrder: number };
};

function groupBranchesByCity(branches: BranchWithCity[]): ExplorerCityGroup[] {
  const map = new Map<number, { cityName: string; citySort: number; branches: ExplorerBranch[] }>();
  for (const b of branches) {
    const cid = b.city.id;
    if (!map.has(cid)) {
      map.set(cid, { cityName: b.city.name, citySort: b.city.sortOrder, branches: [] });
    }
    map.get(cid)!.branches.push({
      id: b.id,
      slug: b.slug,
      name: b.name,
      tagline: b.tagline,
      address: b.address,
      phone: b.phone,
      mapUrl: b.mapUrl,
    });
  }
  return [...map.values()]
    .sort((a, b) => a.citySort - b.citySort || a.cityName.localeCompare(b.cityName, "ar"))
    .map(({ cityName, branches: cityBranches }) => ({ cityName, branches: cityBranches }));
}

export async function BranchesShowcase() {
  const locale = await getLocale();
  const t = await getTranslations("Branches");
  const newBranches = await getNewBranchesForHome(locale);
  const branchesRaw = newBranches.length > 0 ? newBranches : await getActiveBranches(locale);

  if (branchesRaw.length === 0) {
    return null;
  }

  const groups = groupBranchesByCity(branchesRaw as BranchWithCity[]);

  return (
    <section id="branches-new" className="overflow-x-clip bg-gradient-to-b from-white to-[#fdfbf6]">
      <Reveal>
        <div className="mx-auto w-full max-w-screen-xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
          <div className="mb-10 text-center sm:mb-12">
            <div className="mb-4 flex items-center justify-center gap-3">
              <span className="h-px w-10 bg-gradient-to-l from-[#dbb878] to-transparent sm:w-14" aria-hidden />
              <p className="text-[11px] font-bold uppercase tracking-[0.22em] text-[#dbb878]">
                {t("eyebrow")}
              </p>
              <span className="h-px w-10 bg-gradient-to-r from-[#dbb878] to-transparent sm:w-14" aria-hidden />
            </div>
            <h2 className="text-2xl font-black tracking-tight text-[#003749] sm:text-4xl">
              {t("title")}
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm font-medium leading-relaxed text-[#8a7752] sm:text-base">
              {t("subtitle")}
            </p>
          </div>

          <BranchesMapExplorer groups={groups} />
        </div>
      </Reveal>
    </section>
  );
}
