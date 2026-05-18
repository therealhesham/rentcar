import { getActiveBranches, getNewBranchesForHome } from "@/lib/branch-data";
import { Reveal } from "./HomeMotion";

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

function resolveBranchEmbedUrl(branch: {
  slug: string;
  name: string;
  address?: string | null;
  mapUrl?: string | null;
}): string {
  const queryParts = [branch.name, branch.address?.trim()].filter(Boolean);
  const query = queryParts.join(" ، ") || branch.name;
  return `https://maps.google.com/maps?q=${encodeURIComponent(query)}&hl=ar&z=14&output=embed`;
}

type Branch = {
  id: number;
  slug: string;
  name: string;
  tagline?: string | null;
  address?: string | null;
  phone?: string | null;
  mapUrl?: string | null;
};

function BranchCard({ branch }: { branch: Branch }) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl border border-[#dbb878]/50 bg-[#fdf3e0] p-5 shadow-[0_8px_24px_rgba(119,89,39,0.08)] transition-shadow hover:shadow-[0_14px_36px_rgba(119,89,39,0.14)]">
      <header className="text-center">
        <h3 className="text-sm font-extrabold text-[#003749]">{branch.name}</h3>
        <p className="mt-1 text-xs leading-relaxed text-[#775927]">
          {branch.address?.trim() ||
            branch.tagline?.trim() ||
            "فرع روائس لتأجير السيارات"}
        </p>
      </header>

      <div className="min-w-0 overflow-hidden rounded-xl border border-black/5 bg-white">
        <iframe
          title={`موقع ${branch.name} على الخريطة`}
          src={resolveBranchEmbedUrl(branch)}
          className="block h-36 w-full max-w-full"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      </div>

      <a
        href={branch.phone ? `tel:${branch.phone.trim()}` : undefined}
        className="mt-1 inline-flex w-full items-center justify-center gap-2 text-sm font-bold text-[#003749] sm:justify-start"
        dir="ltr"
      >
        <PhoneIcon className="h-4 w-4 shrink-0 text-[#003749]" />
        <span>{branch.phone?.trim() || "—"}</span>
      </a>

      <a
        href={resolveBranchMapUrl(branch.slug, branch.name, branch.mapUrl)}
        target="_blank"
        rel="noreferrer"
        className="text-xs font-bold text-[#775927] underline underline-offset-4 transition-opacity hover:opacity-80"
      >
        موقع الفرع
      </a>
    </article>
  );
}

function BranchGroup({
  title,
  subtitle,
  branches,
}: {
  title: string;
  subtitle: string;
  branches: Branch[];
}) {
  if (branches.length === 0) return null;

  return (
    <div className="bg-white py-12 sm:py-16">
      <div className="relative flex items-center justify-center gap-4 px-4">
        <div className="text-center">
          <p className="text-base font-extrabold tracking-widest text-[#dbb878]">{title}</p>
          <h3 className="mt-0.5 text-xl font-black text-[#003749] sm:text-2xl">{subtitle}</h3>
        </div>
      </div>

      <div className="mx-auto mt-10 w-full max-w-screen-xl px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {branches.map((branch) => (
            <BranchCard key={branch.id} branch={branch} />
          ))}
        </div>
      </div>
    </div>
  );
}

function groupBranchesByCity(
  branches: Array<
    Branch & {
      city: { id: number; name: string; slug: string; sortOrder: number };
    }
  >,
) {
  const map = new Map<
    number,
    { cityName: string; citySort: number; branches: Branch[] }
  >();
  for (const b of branches) {
    const cid = b.city.id;
    if (!map.has(cid)) {
      map.set(cid, {
        cityName: b.city.name,
        citySort: b.city.sortOrder,
        branches: [],
      });
    }
    map.get(cid)!.branches.push(b);
  }
  return [...map.values()].sort((a, b) => a.citySort - b.citySort || a.cityName.localeCompare(b.cityName, "ar"));
}

export async function BranchesShowcase() {
  const newBranches = await getNewBranchesForHome();
  const branchesRaw = newBranches.length > 0 ? newBranches : await getActiveBranches();

  if (branchesRaw.length === 0) {
    return null;
  }

  const groups = groupBranchesByCity(
    branchesRaw as Array<
      Branch & {
        city: { id: number; name: string; slug: string; sortOrder: number };
      }
    >,
  );

  return (
    <section id="branches-new" className="overflow-x-clip">
      <Reveal>
        <div>
          <div className="relative overflow-hidden bg-[#003749] px-4 py-10 text-center sm:px-6 sm:py-16 lg:px-8">
            <h2 className="text-2xl font-extrabold tracking-tight text-white sm:text-4xl">
              فروعنا
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm font-medium text-white/80 sm:text-base">
              مواقعنا المنتشرة لخدمتكم. اختر الفرع المناسب واستعرض موقعه على الخريطة.
            </p>
            <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-[#dbb878]" aria-hidden />
          </div>

          {groups.map((g, i) => (
            <div key={`${g.cityName}-${i}`}>
              {i > 0 ? <div className="h-1 bg-[#dbb878]/40" aria-hidden /> : null}
              <BranchGroup title="فروعنا" subtitle={g.cityName} branches={g.branches} />
            </div>
          ))}
        </div>
      </Reveal>
    </section>
  );
}

function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden
    >
      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.37 1.9.72 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.35 1.85.59 2.81.72A2 2 0 0 1 22 16.92z" />
    </svg>
  );
}
