import { SiteNav } from "@/components/shared/SiteNav";
import { SiteFooter } from "@/components/home/SiteFooter";
import { JsonLd } from "@/components/seo/JsonLd";
import { ContactForm } from "@/components/contact/ContactForm";
import { getActiveBranches } from "@/lib/branch-data";
import { breadcrumbJsonLd, buildPageMetadata } from "@/lib/seo";
import { getTranslations } from "next-intl/server";
import { Mail, MapPin, Phone, Clock } from "lucide-react";

const TEAL = "#003749";
const GOLD = "#dbb878";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }> | { locale: string };
}) {
  const resolvedParams = await params;
  const t = await getTranslations({ locale: resolvedParams.locale, namespace: "ContactPage" });

  return buildPageMetadata({
    title: t("title"),
    description: t("description"),
    path: "/contact",
  });
}

export default async function ContactPage({ params }: { params: Promise<{ locale: string }> }) {
  const resolvedParams = await params;
  const branches = await getActiveBranches(resolvedParams.locale);
  const t = await getTranslations("ContactPage");
  const navT = await getTranslations("SiteNav");

  const branchesWithPhone = branches.filter((b) => b.phone?.trim());

  return (
    <div className="flex min-h-screen flex-col bg-surface text-on-surface">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: navT("home"), path: "/" },
          { name: t("title"), path: "/contact" },
        ])}
      />
      <SiteNav active="contact" />

      {/* ─── Hero ─── */}
      <header
        className="relative flex min-h-[32vh] items-center justify-center overflow-hidden pt-16 sm:min-h-[38vh] sm:pt-20"
        style={{ backgroundColor: TEAL }}
      >
        <div className="relative z-10 px-4 text-center">
          <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl lg:text-5xl">
            {t("heroTitle")}
          </h1>
          <p className="mx-auto mt-3 max-w-2xl text-sm font-medium leading-relaxed text-white/80 sm:text-base">
            {t("heroSubtitle")}
          </p>
        </div>
        <div className="absolute bottom-0 left-0 right-0 h-1.5" style={{ backgroundColor: GOLD }} aria-hidden />
      </header>

      {/* ─── الفورم + بيانات التواصل ─── */}
      <section className="mx-auto w-full max-w-screen-xl px-4 py-14 sm:px-8 sm:py-20">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <ContactForm />
          </div>

          <aside className="flex flex-col gap-5">
            <div className="rounded-3xl border border-[#dbb878]/40 bg-white p-6 shadow-sm">
              <h2 className="text-lg font-extrabold" style={{ color: TEAL }}>
                {t("infoTitle")}
              </h2>
              <p className="mt-2 text-sm leading-relaxed text-neutral-600">{t("infoSubtitle")}</p>

              <ul className="mt-5 space-y-4 text-sm">
                <li className="flex items-start gap-3">
                  <span
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${TEAL}0d`, color: TEAL }}
                  >
                    <Clock className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-bold" style={{ color: TEAL }}>
                      {t("workingHours")}
                    </p>
                    <p className="mt-0.5 text-neutral-600">{t("workingHoursValue")}</p>
                  </div>
                </li>
                <li className="flex items-start gap-3">
                  <span
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: `${TEAL}0d`, color: TEAL }}
                  >
                    <Mail className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-bold" style={{ color: TEAL }}>
                      {t("replyTime")}
                    </p>
                    <p className="mt-0.5 text-neutral-600">{t("replyTimeValue")}</p>
                  </div>
                </li>
              </ul>
            </div>

            {branchesWithPhone.length > 0 && (
              <div className="rounded-3xl border border-[#dbb878]/40 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-extrabold" style={{ color: TEAL }}>
                  {t("branchesTitle")}
                </h2>
                <ul className="mt-4 space-y-4">
                  {branchesWithPhone.map((b) => (
                    <li key={b.id} className="border-b border-neutral-100 pb-4 last:border-0 last:pb-0">
                      <p className="text-sm font-bold" style={{ color: TEAL }}>
                        {b.name}
                      </p>
                      {b.address?.trim() && (
                        <p className="mt-1 flex items-start gap-2 text-xs leading-relaxed text-neutral-600">
                          <MapPin className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 opacity-60" />
                          {b.address}
                        </p>
                      )}
                      <a
                        href={`tel:${b.phone!.replace(/\s/g, "")}`}
                        className="mt-2 inline-flex items-center gap-2 rounded-lg bg-[#dbb878]/15 px-3 py-1.5 text-xs font-bold tabular-nums transition-colors hover:bg-[#dbb878]/30"
                        style={{ color: TEAL }}
                        dir="ltr"
                      >
                        <Phone className="h-3.5 w-3.5" />
                        {b.phone}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </aside>
        </div>
      </section>

      <SiteFooter />
    </div>
  );
}
