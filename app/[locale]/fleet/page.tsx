import type { ReactNode } from "react";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { FleetCarGrid, FleetFilters } from "@/components/fleet";
import { BookingWidget } from "@/components/home";
import { SiteFooter } from "@/components/home/SiteFooter";
import { SiteNav } from "@/components/shared/SiteNav";
import { getActiveBookingCitiesWithBranches } from "@/lib/branch-data";
import { computeBookingDays } from "@/lib/booking-days";
import { formatDailyBookingDurationFromIso } from "@/lib/booking-duration-display";
import { listAvailableCarModelIds } from "@/lib/direct-booking";
import {
  getFleetBrandsForFilter,
  getFleetCarsForDisplay,
  getFleetCategoriesForFilter,
  getFleetPriceBounds,
} from "@/lib/fleet-data";
import { fleetDailyPriceFilterLabel } from "@/components/fleet/FleetDailyPriceFilterLabel";
import { buildFleetSearchUrlHydrate } from "@/lib/fleet-search-url-hydrate";
import { buildPageMetadata } from "@/lib/seo";
import { getBookingWidgetTabFlags, getRentalPriceDisplayMode } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "الأسطول — تصفح السيارات المتاحة",
  description:
    "تصفّح أسطول روائس من السيارات الفاخرة للتأجير اليومي والأسبوعي والشهري. فلترة حسب الماركة والسعر وتوفر الفروع.",
  path: "/fleet",
  ogImage: "/ourfleet.jpg",
});

type FleetSearchParams = Record<string, string | string[] | undefined>;

/** Next قد يمرّر قيمة مكررة كـ string[] — تجنّب استدعاء .trim على مصفوفة */
function qFirst(v: string | string[] | undefined): string | undefined {
  if (v === undefined) return undefined;
  const s = Array.isArray(v) ? v[0] : v;
  const t = typeof s === "string" ? s.trim() : "";
  return t || undefined;
}

export default async function FleetPage({
  searchParams,
  params: routeParams,
}: {
  searchParams?: Promise<FleetSearchParams>;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await routeParams;
  const t = await getTranslations("FleetPage");
  const params = searchParams ? await searchParams : {};
  const fleetUrlHydrate = buildFleetSearchUrlHydrate(params);
  const categoryRaw = qFirst(params.category);
  const brandRaw = qFirst(params.brand);
  const maxPriceRaw = qFirst(params.maxPrice);

  const pickupRaw = qFirst(params.pickup);
  const dropoffRaw = qFirst(params.dropoff);
  const rentalRaw = qFirst(params.rental);

  /** undefined = لا فلترة بالتوفر؛ مصفوفة (قد تكون فارغة) = نتيجة بحث */
  let availabilityModelIds: number[] | undefined;

  let searchBanner: ReactNode = null;

  const [cities, tabFlags, priceMode, categories, brands, priceBounds] = await Promise.all([
    getActiveBookingCitiesWithBranches(locale).catch(() => []),
    getBookingWidgetTabFlags(),
    getRentalPriceDisplayMode(),
    getFleetCategoriesForFilter(locale),
    getFleetBrandsForFilter(locale),
    getFleetPriceBounds(),
  ]);

  const resolveBranchName = (slug: string) => {
    for (const city of cities) {
      const branch = city.branches.find((b) => b.slug.toLowerCase() === slug.toLowerCase());
      if (branch) return branch.name;
    }
    return slug;
  };

  if (pickupRaw && dropoffRaw) {
    const pickupDate = new Date(pickupRaw);
    const dropoffDate = new Date(dropoffRaw);
    if (
      !Number.isNaN(pickupDate.getTime()) &&
      !Number.isNaN(dropoffDate.getTime()) &&
      dropoffDate.getTime() >= pickupDate.getTime()
    ) {
      const days = computeBookingDays(pickupDate, dropoffDate);
      const durationLabel =
        rentalRaw === "daily" || rentalRaw == null || rentalRaw === ""
          ? (formatDailyBookingDurationFromIso(pickupRaw, dropoffRaw) ?? t("daysCount", { days }))
          : t("daysCount", { days });
      const returnBranch =
        qFirst(params.returnBranch)?.toLowerCase() ??
        qFirst(params.pickupBranch)?.toLowerCase() ??
        qFirst(params.branch)?.toLowerCase() ??
        "jeddah";
      availabilityModelIds = await listAvailableCarModelIds({
        pickupDate,
        numberOfDays: days,
        branchSlug: returnBranch,
      });

      const modeLabel = qFirst(params.mode) === "delivery" ? t("deliveryMode") : t("pickupMode");
      const rental =
        rentalRaw === "weekly"
          ? t("weeklyRental")
          : rentalRaw === "monthly"
            ? t("monthlyRental")
            : rentalRaw === "monthly_packages"
              ? t("monthlyPackagesRental")
              : t("dailyRental");

      searchBanner = (
        <div className="mb-8 overflow-hidden rounded-2xl border border-[#003749]/15 bg-gradient-to-l from-[#003749]/5 via-white to-[#003749]/5 shadow-sm">
          <div className="flex items-start gap-4 px-5 py-4 sm:px-6 sm:py-5">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#003749]/10 text-[#003749]">
              <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
                <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-extrabold text-[#003749]">{t("searchResults")}</p>
              <div className="mt-1.5 flex flex-wrap gap-2">
                {[
                  { label: t("type"), value: rental },
                  { label: t("duration"), value: durationLabel },
                  { label: t("pickup"), value: modeLabel },
                  qFirst(params.returnBranch) ? { label: t("branch"), value: resolveBranchName(qFirst(params.returnBranch)!) } : null,
                  qFirst(params.mode) === "delivery" && qFirst(params.daddr)
                    ? { label: t("deliveryAddress"), value: qFirst(params.daddr)! }
                    : null,
                ]
                  .filter(Boolean)
                  .map((item) => (
                    <span
                      key={item!.label}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[#003749]/15 bg-white px-3 py-1 text-xs font-bold text-[#1a3a44] shadow-sm"
                    >
                      <span className="text-[#775927]">{item!.label}</span>
                      <span className="text-[#003749]/40">·</span>
                      <span>
                        {item!.value}
                      </span>
                    </span>
                  ))}
              </div>
              <p className="mt-2 text-[11px] text-neutral-500">
                {t("searchBannerNote")}
              </p>
            </div>
          </div>
        </div>
      );
    }
  }

  const categorySlug =
    categoryRaw && categories.some((c) => c.slug === categoryRaw) ? categoryRaw : undefined;

  const brandIdParsed = brandRaw ? Number(brandRaw) : NaN;
  const brandId =
    Number.isFinite(brandIdParsed) && brands.some((b) => b.id === brandIdParsed)
      ? brandIdParsed
      : undefined;

  const maxPriceParsed = maxPriceRaw ? Number(maxPriceRaw) : NaN;
  const maxPriceExclTax =
    Number.isFinite(maxPriceParsed) &&
    maxPriceParsed >= priceBounds.min &&
    maxPriceParsed < priceBounds.max
      ? maxPriceParsed
      : undefined;

  const displayBranchSlug =
    qFirst(params.returnBranch)?.toLowerCase() ??
    qFirst(params.pickupBranch)?.toLowerCase() ??
    qFirst(params.branch)?.toLowerCase() ??
    null;

  let fleetPickupDate: Date | null = null;
  if (pickupRaw) {
    const d = new Date(pickupRaw);
    if (!Number.isNaN(d.getTime())) fleetPickupDate = d;
  }

  const cars = await getFleetCarsForDisplay({
    categorySlug,
    brandId,
    maxPriceExclTax,
    modelIds: availabilityModelIds,
    branchSlug: displayBranchSlug,
    pickupDate: fleetPickupDate,
    priceDisplayMode: priceMode,
    locale,
    rentalTab: rentalRaw,
  });

  return (
    <div className="flex min-h-screen flex-col bg-surface text-on-surface">
      <SiteNav active="fleet" />
      <div className="pt-28">
        <section
          className="border-b border-outline-variant/60 bg-surface-container-low/90 shadow-[0_8px_28px_-8px_rgba(15,61,71,0.12)] backdrop-blur-md"
        >
          <div className="mx-auto max-w-screen-2xl px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
            
            <div
              id="fleet-booking"
              className="scroll-mt-28 overflow-hidden rounded-2xl bg-white/[0.97] shadow-[0_28px_72px_-20px_rgba(15,61,71,0.18),0_8px_24px_-6px_rgba(15,61,71,0.07)] ring-1 ring-black/[0.03] backdrop-blur-xl"
            >
              <BookingWidget
                cities={cities}
                initialFromUrl={fleetUrlHydrate}
                tabFlags={tabFlags}
                combinedPanel
              />
              <Suspense
                fallback={
                  <div className="border-t border-[#f0ebe4] px-3 py-6 sm:px-5">
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                      <div className="h-14 animate-pulse rounded-xl bg-[#f5f0e6]/80" />
                      <div className="h-14 animate-pulse rounded-xl bg-[#f5f0e6]/80" />
                      <div className="h-14 animate-pulse rounded-xl bg-[#f5f0e6]/80" />
                    </div>
                  </div>
                }
              >
                <FleetFilters
                  variant="embedded"
                  categories={categories}
                  brands={brands}
                  priceBounds={priceBounds}
                  dailyPriceLabel={fleetDailyPriceFilterLabel(priceMode, locale)}
                />
              </Suspense>
            </div>
          </div>
        </section>
        <main id="fleet-results" className="mx-auto max-w-screen-2xl scroll-mt-24 px-4 py-12 sm:px-6 sm:py-16 lg:px-8">
          {searchBanner}

          {/* رأس قسم النتائج */}
          {cars.length > 0 ? (
            <div className="mb-8 flex flex-wrap items-end justify-between gap-4 border-b border-neutral-200/70 pb-6">
              <div>
                <h2 className="text-2xl font-extrabold tracking-tight text-[#003749]">
                  {availabilityModelIds !== undefined ? t("availableVehicles") : t("ourFleet")}
                </h2>
                <p className="mt-1 text-sm text-neutral-500">
                  {availabilityModelIds !== undefined
                    ? (cars.length === 1 ? t("singleAvailableForBooking") : t("availableForBooking", { count: cars.length }))
                    : (cars.length === 1 ? t("singleVehicleInFleet") : t("vehiclesInFleet", { count: cars.length }))}
                </p>
              </div>
              <span className="inline-flex items-center gap-2 rounded-full bg-[#003749]/8 px-4 py-2 text-[13px] font-bold text-[#003749]">
                <span className="relative flex h-2.5 w-2.5">
                  {availabilityModelIds !== undefined ? (
                    <>
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-60" />
                      <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-500" />
                    </>
                  ) : (
                    <span className="inline-flex h-2.5 w-2.5 rounded-full bg-[#dbb878]" />
                  )}
                </span>
                {availabilityModelIds !== undefined ? t("availableNow") : t("browseFleet")}
              </span>
            </div>
          ) : null}

          {availabilityModelIds !== undefined && availabilityModelIds.length === 0 ? (
            <div className="mx-auto max-w-lg rounded-3xl border border-dashed border-neutral-300 bg-white px-8 py-16 text-center shadow-sm">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#003749]/8 text-[#003749]/50">
                <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8" aria-hidden>
                  <path d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2m-10 0h12M7 7a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2V9a2 2 0 00-2-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  <path d="M12 12v4M12 12l-2-2M12 12l2-2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                </svg>
              </div>
              <p className="text-lg font-extrabold text-[#003749]">{t("noAvailableTitle")}</p>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-neutral-500">
                {t("noAvailableSub")}
              </p>
            </div>
          ) : cars.length === 0 ? (
            <div className="mx-auto max-w-lg rounded-3xl border border-dashed border-neutral-300 bg-white px-8 py-16 text-center shadow-sm">
              <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[#dbb878]/15 text-[#775927]">
                <svg viewBox="0 0 24 24" fill="none" className="h-8 w-8" aria-hidden>
                  <path d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </div>
              <p className="text-lg font-extrabold text-[#003749]">{t("noMatchingTitle")}</p>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-neutral-500">
                {t("noMatchingSub")}
              </p>
            </div>
          ) : (
            <FleetCarGrid cars={cars} cities={cities} />
          )}
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}
