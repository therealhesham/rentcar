import { getActiveBranches, getNewBranchesForHome } from "@/lib/branch-data";

const branchMapLinks: Record<string, string> = {
  madinah:
    "https://maps.google.com/?q=%D8%A7%D9%84%D9%85%D8%AF%D9%8A%D9%86%D8%A9+%D8%A7%D9%84%D9%85%D9%86%D9%88%D8%B1%D8%A9",
  jeddah: "https://maps.google.com/?q=%D8%AC%D8%AF%D8%A9",
  riyadh: "https://maps.google.com/?q=%D8%A7%D9%84%D8%B1%D9%8A%D8%A7%D8%B6",
  dammam: "https://maps.google.com/?q=%D8%A7%D9%84%D8%AF%D9%85%D8%A7%D9%85",
  makkah: "https://maps.google.com/?q=%D9%85%D9%83%D8%A9",
};

function resolveBranchMapUrl(slug: string, name: string, mapUrl?: string | null) {
  const direct = mapUrl?.trim();
  if (direct) return direct;
  return branchMapLinks[slug] ?? `https://maps.google.com/?q=${encodeURIComponent(name)}`;
}

export async function BranchesShowcase() {
  const newBranches = await getNewBranchesForHome();
  const branches = newBranches.length > 0 ? newBranches : await getActiveBranches();

  if (branches.length === 0) {
    return null;
  }

  return (
    <section id="branches-new" className="bg-surface-container-low px-4 py-14 sm:px-8 sm:py-20">
      <div className="mx-auto w-full max-w-screen-xl">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-extrabold text-[#003749] sm:text-4xl">فروعنا</h2>
          <p className="mt-3 text-sm text-on-surface-variant sm:text-base">
            مواقعنا المنتشرة لخدمتكم. اختر الفرع المناسب واستعرض موقعه على الخريطة.
          </p>
        </div>

        <div className="relative">
          <div
            className="pointer-events-none absolute left-0 right-0 top-1/2 hidden h-1 -translate-y-1/2 bg-gradient-to-r from-[#dbb878] via-[#b79259] to-[#dbb878] lg:block"
            aria-hidden
          />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            {[0, 1, 2].map((col) => (
              <div key={col} className="space-y-6">
                {branches
                  .filter((_, i) => i % 3 === col)
                  .map((branch) => (
                    <article
                      key={branch.id}
                      className="relative rounded-2xl border border-[#dbb878]/50 bg-[#fffaf2] p-5 shadow-sm"
                    >
                      <h3 className="text-sm font-extrabold text-[#003749]">{branch.name}</h3>
                      <p className="mt-2 min-h-10 text-xs leading-relaxed text-on-surface-variant">
                        {branch.address?.trim() ||
                          branch.tagline?.trim() ||
                          "فرع روائس لتأجير السيارات"}
                      </p>
                      <p className="mt-4 text-xs font-bold text-[#003749]" dir="ltr">
                        {branch.phone?.trim() || "—"}
                      </p>
                      <a
                        href={resolveBranchMapUrl(branch.slug, branch.name, branch.mapUrl)}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex items-center gap-1 text-xs font-bold text-[#775927] underline underline-offset-4"
                      >
                        موقع الفرع
                        <span aria-hidden>↗</span>
                      </a>
                    </article>
                  ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
