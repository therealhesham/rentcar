import Image from "next/image";
import { SiteNav } from "@/components/shared/SiteNav";
import { SiteFooter } from "@/components/home/SiteFooter";
import { JsonLd } from "@/components/seo/JsonLd";
import { getActiveBranches } from "@/lib/branch-data";
import { breadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";
import { getTranslations } from "next-intl/server";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> | { locale: string } }) {
  const resolvedParams = await params;
  const t = await getTranslations({ locale: resolvedParams.locale, namespace: "AboutPage" });

  return buildPageMetadata({
    title: t("title"),
    description: t("description"),
    path: "/about",
  });
}

const pillars = [
  {
    key: "vision",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="h-10 w-10" aria-hidden>
        <circle cx="20" cy="20" r="19" stroke="#003749" strokeWidth="2" />
        <circle cx="20" cy="20" r="10" stroke="#dbb878" strokeWidth="2" />
        <circle cx="20" cy="20" r="3" fill="#003749" />
      </svg>
    ),
  },
  {
    key: "mission",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="h-10 w-10" aria-hidden>
        <path
          d="M20 4L24.5 15H36L26.7 21.8L30.5 33L20 26.5L9.5 33L13.3 21.8L4 15H15.5L20 4Z"
          stroke="#003749"
          strokeWidth="2"
          fill="none"
        />
        <circle cx="20" cy="19" r="4" fill="#dbb878" />
      </svg>
    ),
  },
  {
    key: "values",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="h-10 w-10" aria-hidden>
        <rect x="4" y="4" width="32" height="32" rx="8" stroke="#003749" strokeWidth="2" />
        <path d="M13 20l5 5 9-10" stroke="#dbb878" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    key: "fields",
    icon: (
      <svg viewBox="0 0 40 40" fill="none" className="h-10 w-10" aria-hidden>
        <path d="M8 32 L8 20 L16 20 L16 32" stroke="#003749" strokeWidth="2" strokeLinecap="round" />
        <path d="M18 32 L18 14 L26 14 L26 32" stroke="#dbb878" strokeWidth="2" strokeLinecap="round" />
        <path d="M28 32 L28 8 L36 8 L36 32" stroke="#003749" strokeWidth="2" strokeLinecap="round" />
      </svg>
    ),
  },
];

const branchMapLinks: Record<string, string> = {
  madinah: "https://maps.google.com/?q=%D8%A7%D9%84%D9%85%D8%AF%D9%8A%D9%86%D8%A9+%D8%A7%D9%84%D9%85%D9%86%D9%88%D8%B1%D8%A9",
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

/** يبني رابط iframe قابل للتضمين من بيانات الفرع. */
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

export default async function AboutPage({ params }: { params: Promise<{ locale: string }> }) {
  const resolvedParams = await params;
  const branches = await getActiveBranches(resolvedParams.locale);
  const t = await getTranslations("AboutPage");
  const navT = await getTranslations("SiteNav");

  return (
    <div className="flex min-h-screen flex-col bg-surface text-on-surface">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: navT("home"), path: "/" },
          { name: t("title"), path: "/about" },
        ])}
      />
      <SiteNav active="about" />

      {/* ─── Hero ─── */}
      <header className="relative flex min-h-[40vh] items-center justify-center overflow-hidden pt-16 sm:min-h-[50vh] sm:pt-20">
        <Image
          src="https://images.unsplash.com/photo-1489821584143-984f940e1256?auto=format&fit=crop&w=1600&q=80"
          alt={t("carRental")}
          fill
          priority
          className="object-cover"
          sizes="100vw"
        />
        <div className="absolute inset-0 bg-[#003749]" />
        <div className="relative z-10 px-4 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
            {t("carRental")}
          </h1>
          <p className="mt-3 text-sm font-medium text-white/80 sm:text-base">
            {t("heroSubtitle")}
          </p>
        </div>
        {/* شريط ذهبي سفلي */}
        <div className="absolute bottom-0 left-0 right-0 h-1.5 bg-[#dbb878]" aria-hidden />
      </header>

      {/* ─── أعمدة الهوية (رؤية / رسالة / قيم / ميادين) ─── */}
      <section className="mx-auto w-full max-w-screen-xl px-4 py-14 sm:px-8 sm:py-20">
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {pillars.map((p) => (
            <div
              key={p.key}
              className="flex flex-col gap-4 rounded-2xl border border-[#dbb878]/40 bg-white p-6 shadow-sm transition-shadow hover:shadow-md"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-[#003749]/5">
                {p.icon}
              </div>
              <h2 className="text-lg font-extrabold text-[#003749]">{t(`pillars.${p.key}.title`)}</h2>
              <p className="text-sm leading-relaxed text-on-surface-variant">{t(`pillars.${p.key}.body`)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ─── هدفنا ─── */}
      <section className="bg-surface-container-low px-4 py-14 sm:px-8 sm:py-20">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-10 md:flex-row md:items-start md:gap-16">
          {/* النص + الرسم البياني */}
          <div className="order-2 flex flex-1 flex-col gap-6 text-center md:order-1 md:text-start">
            <h2 className="text-3xl font-extrabold text-[#003749] sm:text-4xl">{t("ourGoal")}</h2>
            <p className="text-sm leading-loose text-on-surface-variant sm:text-base">
              {t("goalBody1")}
            </p>
            <p className="text-sm leading-loose text-on-surface-variant sm:text-base">
              {t("goalBody2")}
            </p>

            {/* رسم بياني */}
            <div className="mt-4 flex justify-center md:justify-start" aria-hidden>
              <svg
                viewBox="0 0 120 80"
                className="h-20 w-32 sm:h-24 sm:w-40"
                fill="#003749"
              >
                <rect x="6" y="50" width="14" height="26" rx="2" />
                <rect x="28" y="38" width="14" height="38" rx="2" />
                <rect x="50" y="22" width="14" height="54" rx="2" />
                <rect x="72" y="6" width="14" height="70" rx="2" />
                <line
                  x1="0"
                  y1="78"
                  x2="120"
                  y2="78"
                  stroke="#003749"
                  strokeWidth="1.5"
                />
              </svg>
            </div>
          </div>

          {/* رسم الهدف من ملف target.png */}
          <div className="order-1 flex shrink-0 items-center justify-center md:order-2" aria-hidden>
            <Image
              src="/target.png"
              alt=""
              width={360}
              height={360}
              className="h-56 w-56 object-contain sm:h-72 sm:w-72 md:h-80 md:w-80 lg:h-[22rem] lg:w-[22rem]"
            />
          </div>
        </div>
      </section>

      {/* ─── فروعنا ─── */}
      <section className="overflow-x-clip bg-surface">
        <div className="mx-auto w-full min-w-0 max-w-screen-xl px-4 py-14 sm:px-6 sm:py-20 lg:px-8">
        <div className="mb-10 text-center">
          <h2 className="text-3xl font-extrabold text-[#003749] sm:text-4xl">{t("ourBranches")}</h2>
          <p className="mt-3 text-sm text-on-surface-variant sm:text-base">
            {t("branchesSubtitle")}
          </p>
        </div>

        {branches.length > 0 ? (
          <div className="grid min-w-0 grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {branches.map((branch) => (
              <article
                key={branch.id}
                className="flex flex-col gap-3 rounded-2xl border border-[#dbb878]/50 bg-[#fdf3e0] p-5 shadow-[0_8px_24px_rgba(119,89,39,0.08)] transition-shadow hover:shadow-[0_14px_36px_rgba(119,89,39,0.14)]"
              >
                <header className="text-center">
                  <h3 className="text-sm font-extrabold text-[#003749]">{branch.name}</h3>
                  <p className="mt-1 text-xs leading-relaxed text-on-surface-variant">
                    {branch.address?.trim() ||
                      branch.tagline?.trim() ||
                      t("defaultBranchAddress")}
                  </p>
                </header>

                <div className="min-w-0 overflow-hidden rounded-xl border border-black/5 bg-white">
                  <iframe
                    title={t("mapLocationOf", { name: branch.name })}
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
                  {t("branchLocation")}
                </a>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-outline bg-white/70 p-8 text-center text-sm text-on-surface-variant">
            {t("noBranches")}
          </div>
        )}
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
