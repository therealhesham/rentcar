import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import {
  ArrowLeft,
  CalendarDays,
  Cog,
  Fuel,
  Headset,
  MapPin,
  Settings2,
  Tag,
  Users,
  Wallet,
} from "lucide-react";
import { SiteFooter } from "@/components/home/SiteFooter";
import { JsonLd } from "@/components/seo/JsonLd";
import { SiteNav } from "@/components/shared/SiteNav";
import { SarAmountWithSymbol } from "@/components/ui/SarAmountWithSymbol";
import { getCarLandingData, parseCarLandingModelId, type CarLandingDTO } from "@/lib/car-landing-data";
import { Link } from "@/i18n/routing";
import { absoluteUrl, breadcrumbJsonLd, SITE_NAME_AR, SITE_NAME_EN_FULL } from "@/lib/seo";

export const dynamic = "force-dynamic";

type RouteParams = Promise<{ locale: string; modelId: string }>;

/** نفس تقريب بطاقة الأسطول: الرقم المنسّق → أعلى عدد صحيح. */
function ceilAmount(formatted: string): number {
  return Math.ceil(Number(formatted.replace(/,/g, "")));
}

async function loadCar(params: RouteParams) {
  const { locale, modelId: raw } = await params;
  const modelId = parseCarLandingModelId(raw);
  if (modelId == null) return { locale, car: null };
  return { locale, car: await getCarLandingData(modelId, locale) };
}

export async function generateMetadata({ params }: { params: RouteParams }): Promise<Metadata> {
  const { locale, car } = await loadCar(params);
  const t = await getTranslations("CarLanding");
  if (!car) return { title: t("unavailableTitle"), robots: { index: false, follow: false } };

  const isEn = locale === "en";
  const price = car.priceUi ? ceilAmount(car.priceUi.primaryAmount) : null;
  const title = t("metaTitle", { car: car.fullTitle, year: car.year });
  const description =
    t("metaDescription", {
      car: car.fullTitle,
      year: car.year,
      category: car.categoryTitle,
      seats: car.seats,
      transmission: t(`transmission.${car.transmission}`),
      fuel: t(`fuel.${car.fuel}`),
    }) + (price != null ? t("metaDescriptionPrice", { price }) : "");
  const url = absoluteUrl(`/fleet/car/${car.modelId}`);
  const siteName = isEn ? SITE_NAME_EN_FULL : SITE_NAME_AR;

  // صورة المشاركة تأتي من `opengraph-image.tsx` / `twitter-image.tsx` في نفس المجلد.
  return {
    title,
    description,
    alternates: { canonical: url },
    robots: { index: true, follow: true },
    openGraph: {
      type: "website",
      url,
      siteName,
      locale: isEn ? "en_US" : "ar_SA",
      title: `${title} — ${siteName}`,
      description,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} — ${siteName}`,
      description,
    },
  };
}

function SpecItem({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm sm:p-5">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#003749]/8 text-[#003749]">
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-[12px] font-semibold text-neutral-500">{label}</p>
        <p className="truncate text-[15px] font-extrabold text-[#003749]">
          <bdi>{value}</bdi>
        </p>
      </div>
    </div>
  );
}

function PriceBlock({
  car,
  locale,
  startingFromLabel,
  perDayLabel,
  tone,
}: {
  car: CarLandingDTO;
  locale: string;
  startingFromLabel: string;
  perDayLabel: string;
  tone: "dark" | "light";
}) {
  const p = car.priceUi;
  if (!p) return null;
  const isEn = locale === "en";
  const footnote = isEn ? (p.footnoteEn ?? p.footnoteAr) : p.footnoteAr;
  const discount = isEn ? (p.discountLabelEn ?? p.discountLabelAr) : p.discountLabelAr;
  const muted = tone === "dark" ? "text-white/65" : "text-neutral-500";
  const strong = tone === "dark" ? "text-white" : "text-[#003749]";

  return (
    <div>
      <p className={`text-[13px] font-bold ${muted}`}>{startingFromLabel}</p>
      <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
        {p.originalPrimaryAmount ? (
          <SarAmountWithSymbol
            className={`text-lg font-semibold line-through decoration-red-400 decoration-2 opacity-70 ${muted}`}
            glyphClassName="h-[0.75em] w-[0.75em]"
          >
            {ceilAmount(p.originalPrimaryAmount)}
          </SarAmountWithSymbol>
        ) : null}
        <SarAmountWithSymbol
          bold
          className={strong}
          amountClassName="text-5xl font-black leading-none tracking-tight sm:text-6xl"
          glyphClassName="h-8 w-8 text-[#dbb878]"
        >
          {ceilAmount(p.primaryAmount)}
        </SarAmountWithSymbol>
        <span className={`text-base font-bold ${muted}`}>{perDayLabel}</span>
        {discount ? (
          <span className="rounded-full bg-red-500 px-3 py-1 text-xs font-extrabold text-white">
            {discount}
          </span>
        ) : null}
      </div>
      <p className={`mt-2 text-[12px] ${muted}`}>{footnote}</p>
    </div>
  );
}

export default async function CarLandingPage({ params }: { params: RouteParams }) {
  const { locale, car } = await loadCar(params);
  if (!car) notFound();

  const t = await getTranslations("CarLanding");
  const tCommon = await getTranslations("Common");
  const tWhy = await getTranslations("WhyChooseUs");
  const tSimilar = await getTranslations("OrSimilarModal");

  const available = car.priceUi != null;
  const checkoutHref = `/fleet/checkout?modelId=${car.modelId}`;
  const startingFrom = t("startingFrom");
  const perDay = t("perDay");

  const jsonLd = [
    breadcrumbJsonLd([
      { name: t("breadcrumbFleet"), path: "/fleet" },
      { name: car.fullTitle, path: `/fleet/car/${car.modelId}` },
    ]),
    {
      "@context": "https://schema.org",
      "@type": "Product",
      name: `${car.fullTitle} ${car.year}`,
      image: car.image,
      category: car.categoryTitle,
      brand: { "@type": "Brand", name: car.brand },
      url: absoluteUrl(`/fleet/car/${car.modelId}`),
      ...(car.priceUi
        ? {
            offers: {
              "@type": "Offer",
              priceCurrency: "SAR",
              price: ceilAmount(car.priceUi.primaryAmount),
              availability: "https://schema.org/InStock",
              url: absoluteUrl(`/fleet/car/${car.modelId}`),
            },
          }
        : {}),
    },
  ];

  const cta = available ? (
    <Link
      href={checkoutHref}
      className="group/cta relative inline-flex w-full items-center justify-center gap-2.5 overflow-hidden rounded-2xl bg-[#dbb878] px-8 py-4 text-lg font-black text-[#003749] shadow-[0_12px_32px_-8px_rgba(219,184,120,0.65)] transition-all duration-200 hover:bg-[#e6c98d] active:scale-[0.98] sm:w-auto"
    >
      <CalendarDays className="h-5 w-5" aria-hidden />
      {tCommon("bookNow")}
      <ArrowLeft
        className="h-5 w-5 transition-transform duration-200 group-hover/cta:-translate-x-1 ltr:rotate-180 ltr:group-hover/cta:translate-x-1"
        aria-hidden
      />
    </Link>
  ) : (
    <Link
      href="/fleet"
      className="inline-flex w-full items-center justify-center gap-2.5 rounded-2xl bg-white/10 px-8 py-4 text-lg font-black text-white ring-1 ring-white/30 transition hover:bg-white/20 sm:w-auto"
    >
      {t("browseFleet")}
    </Link>
  );

  const whyItems = [
    { icon: <Wallet className="h-5 w-5" />, title: tWhy("feature2.title"), text: tWhy("feature2.description") },
    { icon: <Headset className="h-5 w-5" />, title: tWhy("feature3.title"), text: tWhy("feature3.description") },
    { icon: <MapPin className="h-5 w-5" />, title: tWhy("feature4.title"), text: tWhy("feature4.description") },
  ];

  return (
    <div className="flex min-h-screen flex-col bg-[#f4f4f5] text-on-surface">
      <JsonLd data={jsonLd} />
      <SiteNav active="fleet" />

      <main className="flex-1 pb-28 lg:pb-0">
        {/* ────── الهيرو ────── */}
        <section className="relative overflow-hidden bg-[linear-gradient(135deg,#00222e_0%,#003749_55%,#005a6e_100%)] pt-16 text-white sm:pt-24">
          <div
            className="pointer-events-none absolute -top-24 start-1/2 h-[520px] w-[520px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(219,184,120,0.28),transparent)]"
            aria-hidden
          />
          <div className="relative mx-auto grid max-w-screen-xl items-center gap-6 px-4 pb-14 pt-10 sm:px-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-10 lg:pb-20 lg:pt-16">
            <div className="order-2 lg:order-1">
              <p className="inline-flex items-center gap-2 rounded-full bg-[#dbb878]/15 px-4 py-1.5 text-[13px] font-extrabold text-[#dbb878] ring-1 ring-[#dbb878]/30">
                <Tag className="h-3.5 w-3.5" aria-hidden />
                {t("eyebrow")} · {car.categoryTitle}
              </p>

              <h1 className="mt-5 text-4xl font-black leading-tight tracking-tight sm:text-5xl lg:text-6xl">
                <bdi>{car.brand}</bdi> <bdi>{car.name}</bdi>
                <span className="ms-3 align-middle text-2xl font-bold text-white/55 sm:text-3xl">
                  <bdi>{car.year}</bdi>
                </span>
              </h1>
              <p className="mt-2 text-sm font-semibold text-white/60">{tSimilar("subtitle")}</p>

              {available ? (
                <>
                  <p className="mt-5 max-w-md text-base leading-relaxed text-white/75">{t("heroSub")}</p>
                  <div className="mt-8">
                    <PriceBlock
                      car={car}
                      locale={locale}
                      startingFromLabel={startingFrom}
                      perDayLabel={perDay}
                      tone="dark"
                    />
                  </div>
                </>
              ) : (
                <div className="mt-6 max-w-md rounded-2xl bg-white/10 p-5 ring-1 ring-white/20">
                  <p className="text-lg font-extrabold">{t("unavailableTitle")}</p>
                  <p className="mt-1 text-sm leading-relaxed text-white/70">{t("unavailableSub")}</p>
                </div>
              )}

              <div className="mt-8 hidden lg:block">{cta}</div>
            </div>

            <div className="order-1 lg:order-2">
              <div className="relative mx-auto aspect-[16/10] w-full max-w-[720px]">
                <div
                  className="absolute inset-x-[8%] bottom-[6%] h-[14%] rounded-[50%] bg-black/45 blur-2xl"
                  aria-hidden
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={car.image}
                  alt={car.alt}
                  fetchPriority="high"
                  className="relative h-full w-full object-contain drop-shadow-[0_24px_40px_rgba(0,0,0,0.45)]"
                />
                {car.badge ? (
                  <span className="absolute start-2 top-2 rounded-full bg-white/95 px-3 py-1 text-xs font-extrabold text-[#003749] shadow-lg">
                    {car.badge}
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </section>

        {/* ────── المواصفات ────── */}
        <section className="mx-auto max-w-screen-xl px-4 py-12 sm:px-6 sm:py-16">
          <h2 className="text-2xl font-black tracking-tight text-[#003749] sm:text-3xl">{t("specsTitle")}</h2>
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 lg:gap-4">
            <SpecItem icon={<CalendarDays className="h-5 w-5" />} label={t("specYear")} value={String(car.year)} />
            <SpecItem
              icon={<Users className="h-5 w-5" />}
              label={t("specSeats")}
              value={t("seatsValue", { count: car.seats })}
            />
            <SpecItem
              icon={<Settings2 className="h-5 w-5" />}
              label={t("specTransmission")}
              value={t(`transmission.${car.transmission}`)}
            />
            <SpecItem icon={<Fuel className="h-5 w-5" />} label={t("specFuel")} value={t(`fuel.${car.fuel}`)} />
            {car.engine ? (
              <SpecItem icon={<Cog className="h-5 w-5" />} label={t("specEngine")} value={car.engine} />
            ) : null}
            <SpecItem icon={<Tag className="h-5 w-5" />} label={t("specCategory")} value={car.categoryTitle} />
          </div>
          <p className="mt-5 text-[13px] leading-relaxed text-neutral-500">{t("orSimilarNote")}</p>
        </section>

        {/* ────── لماذا روائس ────── */}
        <section className="border-t border-neutral-200 bg-white">
          <div className="mx-auto max-w-screen-xl px-4 py-12 sm:px-6 sm:py-16">
            <h2 className="text-2xl font-black tracking-tight text-[#003749] sm:text-3xl">{t("whyTitle")}</h2>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {whyItems.map((w) => (
                <div key={w.title} className="rounded-2xl border border-neutral-200 bg-[#fafafa] p-5">
                  <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-[#dbb878]/25 text-[#775927]">
                    {w.icon}
                  </span>
                  <h3 className="mt-4 text-base font-extrabold text-[#003749]">{w.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-neutral-600">{w.text}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ────── دعوة أخيرة ────── */}
        <section className="mx-auto max-w-screen-xl px-4 py-12 sm:px-6 sm:py-16">
          <div className="overflow-hidden rounded-3xl bg-[linear-gradient(135deg,#003749_0%,#005a6e_100%)] px-6 py-10 text-center text-white shadow-xl sm:px-10 sm:py-14">
            <h2 className="text-2xl font-black sm:text-3xl">{t("ctaTitle")}</h2>
            <p className="mx-auto mt-2 max-w-lg text-sm leading-relaxed text-white/75 sm:text-base">
              {t("ctaSub", { car: car.fullTitle })}
            </p>
            <div className="mt-7 flex flex-col items-center justify-center gap-3 sm:flex-row">
              {cta}
              {available ? (
                <Link
                  href="/fleet"
                  className="inline-flex w-full items-center justify-center rounded-2xl px-6 py-4 text-base font-bold text-white/85 ring-1 ring-white/30 transition hover:bg-white/10 sm:w-auto"
                >
                  {t("browseFleet")}
                </Link>
              ) : null}
            </div>
          </div>
        </section>
      </main>

      {/* شريط الحجز الثابت للجوال */}
      {available ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-200 bg-white/95 px-4 py-3 shadow-[0_-8px_24px_-12px_rgba(0,55,73,0.35)] backdrop-blur lg:hidden">
          <div className="mx-auto flex max-w-screen-xl items-center justify-between gap-4">
            <div className="min-w-0">
              <p className="text-[11px] font-bold text-neutral-500">{startingFrom}</p>
              <div className="flex items-baseline gap-1.5">
                <SarAmountWithSymbol
                  bold
                  className="text-[#003749]"
                  amountClassName="text-2xl font-black leading-none"
                  glyphClassName="h-5 w-5 text-[#775927]"
                >
                  {ceilAmount(car.priceUi!.primaryAmount)}
                </SarAmountWithSymbol>
                <span className="text-xs font-bold text-neutral-500">{perDay}</span>
              </div>
            </div>
            <Link
              href={checkoutHref}
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-[#003749] px-6 py-3 text-base font-black text-white shadow-md active:scale-[0.97]"
            >
              {tCommon("bookNow")}
            </Link>
          </div>
        </div>
      ) : null}

      <SiteFooter />
    </div>
  );
}
