import type { ReactNode } from "react";
import { Suspense } from "react";
import { FleetCarGrid, FleetFilters } from "@/components/fleet";
import { BookingWidget } from "@/components/home";
import { SiteFooter } from "@/components/home/SiteFooter";
import { SiteNav } from "@/components/shared/SiteNav";
import { getActiveBranches, getActiveBookingCitiesWithBranches } from "@/lib/branch-data";
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
}: {
  searchParams?: Promise<FleetSearchParams>;
}) {
  const params = searchParams ? await searchParams : {};
  const fleetUrlHydrate = buildFleetSearchUrlHydrate(params);
  const categoryRaw = qFirst(params.category);
  const brandRaw = qFirst(params.brand);
  const maxPriceRaw = qFirst(params.maxPrice);

  const pickupRaw = qFirst(params.pickup);
  const dropoffRaw = qFirst(params.dropoff);

  /** undefined = لا فلترة بالتوفر؛ مصفوفة (قد تكون فارغة) = نتيجة بحث */
  let availabilityModelIds: number[] | undefined;

  let searchBanner: ReactNode = null;

  if (pickupRaw && dropoffRaw) {
    const pickupDate = new Date(pickupRaw);
    const dropoffDate = new Date(dropoffRaw);
    if (
      !Number.isNaN(pickupDate.getTime()) &&
      !Number.isNaN(dropoffDate.getTime()) &&
      dropoffDate.getTime() >= pickupDate.getTime()
    ) {
      const days = computeBookingDays(pickupDate, dropoffDate);
      const rentalRaw = qFirst(params.rental);
      const durationLabel =
        rentalRaw === "daily" || rentalRaw == null || rentalRaw === ""
          ? (formatDailyBookingDurationFromIso(pickupRaw, dropoffRaw) ?? `${days} يوم`)
          : `${days} يوم/أيام`;
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

      const modeLabel = qFirst(params.mode) === "delivery" ? "توصيل" : "استلام من الفرع";
      const rental =
        rentalRaw === "weekly"
          ? "أسبوعي"
          : rentalRaw === "monthly"
            ? "شهري"
            : rentalRaw === "monthly_packages"
              ? "باقات شهرية"
              : "يومي";

      searchBanner = (
        <div className="mx-auto mb-10 max-w-screen-2xl rounded-2xl border border-[#f97316]/25 bg-[#fff7ed] px-6 py-4 text-start shadow-sm">
          <p className="text-sm font-extrabold text-[#c2410c]">نتائج البحث من الصفحة الرئيسية</p>
          <p className="mt-1 text-sm text-on-surface">
            <span className="font-bold">{modeLabel}</span>
            {" · "}
            نوع الإيجار: <span className="font-bold">{rental}</span>
            {" · "}
            المدة: <span className="font-bold tabular-nums">{durationLabel}</span>
            {qFirst(params.returnBranch) ? (
              <>
                {" · "}
                فرع الإرجاع:{" "}
                <span className="font-bold" dir="ltr">
                  {qFirst(params.returnBranch)}
                </span>
              </>
            ) : null}
            {qFirst(params.mode) === "delivery" &&
            qFirst(params.dlat) &&
            qFirst(params.dlng) &&
            !Number.isNaN(Number(qFirst(params.dlat))) &&
            !Number.isNaN(Number(qFirst(params.dlng))) ? (
              <>
                {" · "}
                موقع التوصيل:{" "}
                <span className="tabular-nums font-mono text-xs" dir="ltr">
                  {Number(qFirst(params.dlat)).toFixed(5)}, {Number(qFirst(params.dlng)).toFixed(5)}
                </span>
              </>
            ) : null}
            {qFirst(params.mode) === "delivery" && qFirst(params.daddr) ? (
              <>
                {" · "}
                عنوان التوصيل:{" "}
                <span className="max-w-[16rem] truncate font-bold align-bottom" dir="rtl" title={qFirst(params.daddr)}>
                  {qFirst(params.daddr)}
                </span>
              </>
            ) : null}
          </p>
          <p className="mt-2 text-xs text-on-surface-variant">
            تُعرض المركبات المتاحة للحجز المباشر في هذه الفترة فقط. اضغط «احجز الآن» لمراجعة السعر والإضافات وإتمام
            الطلب.
          </p>
        </div>
      );
    }
  }

  const [priceMode, categories, brands, priceBounds] = await Promise.all([
    getRentalPriceDisplayMode(),
    getFleetCategoriesForFilter(),
    getFleetBrandsForFilter(),
    getFleetPriceBounds(),
  ]);

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

  const cars = await getFleetCarsForDisplay({
    categorySlug,
    brandId,
    maxPriceExclTax,
    modelIds: availabilityModelIds,
    branchSlug: displayBranchSlug,
    priceDisplayMode: priceMode,
  });

  const [branchRows, cities, tabFlags] = await Promise.all([
    getActiveBranches().catch(() => []),
    getActiveBookingCitiesWithBranches().catch(() => []),
    getBookingWidgetTabFlags(),
  ]);
  const branchOptions =
    branchRows.length > 0
      ? branchRows.map((b) => ({ slug: b.slug, name: b.name }))
      : [
          { slug: "jeddah", name: "جدة" },
          { slug: "madinah", name: "المدينة المنورة" },
          { slug: "tabuk", name: "تبوك" },
        ];

  return (
    <div className="flex min-h-screen flex-col bg-surface text-on-surface">
      <SiteNav active="fleet" />
      <div className="pt-28">
        <section
          className="border-b border-outline-variant/60 bg-surface-container-low/90 shadow-[0_8px_28px_-8px_rgba(15,61,71,0.12)] backdrop-blur-md"
          dir="rtl"
        >
          <div className="mx-auto max-w-screen-2xl px-4 py-4 sm:px-6 sm:py-5 lg:px-8">
            <div className="mb-3 flex items-center justify-center gap-3 sm:mb-4">
              <span className="h-px w-10 bg-gradient-to-l from-primary/35 to-transparent sm:w-12" />
              <span className="text-[10px] font-bold uppercase tracking-[0.22em] text-on-surface-variant sm:text-[11px]">
                احجز مركبتك وصفِّ النتائج
              </span>
              <span className="h-px w-10 bg-gradient-to-r from-primary/35 to-transparent sm:w-12" />
            </div>
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
                  dailyPriceLabel={fleetDailyPriceFilterLabel(priceMode)}
                />
              </Suspense>
            </div>
          </div>
        </section>
        <main id="fleet-results" className="mx-auto max-w-screen-2xl px-8 py-24 scroll-mt-24">
          {searchBanner}
          {availabilityModelIds !== undefined && availabilityModelIds.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-outline-variant/50 bg-surface-container-low/50 px-8 py-16 text-center">
              <p className="text-lg font-bold text-on-surface">
                لا توجد مركبات متاحة للحجز المباشر في الفترة التي اخترتها.
              </p>
              <p className="mt-2 text-on-surface-variant">
                جرّب تغيير التواريخ أو تصفح الأسطول كاملاً بدون فلترة التوفر.
              </p>
            </div>
          ) : cars.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-outline-variant/50 bg-surface-container-low/50 px-8 py-16 text-center">
              <p className="text-lg font-bold text-on-surface">لا توجد مركبات تطابق الفلاتر المحددة.</p>
              <p className="mt-2 text-on-surface-variant">
                غيّر التصنيف أو الماركة أو نطاق السعر لتصفية النتائج تلقائياً.
              </p>
            </div>
          ) : (
            <FleetCarGrid cars={cars} branchOptions={branchOptions} />
          )}
        </main>
      </div>
      <SiteFooter />
    </div>
  );
}
