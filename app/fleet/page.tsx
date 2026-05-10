import type { Metadata } from "next";
import type { ReactNode } from "react";
import { FleetCarGrid, FleetFilters } from "@/components/fleet";
import { SiteFooter } from "@/components/home/SiteFooter";
import { SiteNav } from "@/components/shared/SiteNav";
import { getActiveBranches } from "@/lib/branch-data";
import { computeBookingDays } from "@/lib/booking-days";
import { listAvailableCarModelIds } from "@/lib/direct-booking";
import { getFleetCarsForDisplay } from "@/lib/fleet-data";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "الأسطول | Rawaes",
  description:
    "مجموعة مختارة من أرقى السيارات للتأجير اليومي مع فلاتر بحث وتجربة كونسيرج.",
};

type FleetSearchParams = {
  category?: string;
  pickup?: string;
  dropoff?: string;
  rental?: string;
  mode?: string;
  pickupBranch?: string;
  returnBranch?: string;
  dlat?: string;
  dlng?: string;
};

export default async function FleetPage({
  searchParams,
}: {
  searchParams?: Promise<FleetSearchParams>;
}) {
  const params = searchParams ? await searchParams : {};
  const categorySlug = params.category?.trim() || undefined;

  const pickupRaw = params.pickup?.trim();
  const dropoffRaw = params.dropoff?.trim();

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
      availabilityModelIds = await listAvailableCarModelIds({
        pickupDate,
        numberOfDays: days,
      });

      const modeLabel = params.mode === "delivery" ? "توصيل" : "استلام من الفرع";
      const rental = params.rental === "weekly" ? "أسبوعي" : params.rental === "flex" ? "فليكس" : "يومي";

      searchBanner = (
        <div className="mx-auto mb-10 max-w-screen-2xl rounded-2xl border border-[#f97316]/25 bg-[#fff7ed] px-6 py-4 text-start shadow-sm">
          <p className="text-sm font-extrabold text-[#c2410c]">نتائج البحث من الصفحة الرئيسية</p>
          <p className="mt-1 text-sm text-on-surface">
            <span className="font-bold">{modeLabel}</span>
            {" · "}
            نوع الإيجار: <span className="font-bold">{rental}</span>
            {" · "}
            المدة:{" "}
            <span className="tabular-nums font-bold" dir="ltr">
              {days}
            </span>{" "}
            يوم/أيام
            {params.returnBranch ? (
              <>
                {" · "}
                فرع الإرجاع:{" "}
                <span className="font-bold" dir="ltr">
                  {params.returnBranch}
                </span>
              </>
            ) : null}
            {params.mode === "delivery" &&
            params.dlat &&
            params.dlng &&
            !Number.isNaN(Number(params.dlat)) &&
            !Number.isNaN(Number(params.dlng)) ? (
              <>
                {" · "}
                موقع التوصيل:{" "}
                <span className="tabular-nums font-mono text-xs" dir="ltr">
                  {Number(params.dlat).toFixed(5)}, {Number(params.dlng).toFixed(5)}
                </span>
              </>
            ) : null}
          </p>
          <p className="mt-2 text-xs text-on-surface-variant">
            تُعرض المركبات المتاحة للحجز المباشر في هذه الفترة فقط. افتح «احجز الآن» لإكمال بياناتك.
          </p>
        </div>
      );
    }
  }

  const cars = await getFleetCarsForDisplay(categorySlug, availabilityModelIds);

  const branchRows = await getActiveBranches().catch(() => []);
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
        <FleetFilters />
        <main className="mx-auto max-w-screen-2xl px-8 py-24">
          {searchBanner}
          {availabilityModelIds && cars.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-outline-variant/50 bg-surface-container-low/50 px-8 py-16 text-center">
              <p className="text-lg font-bold text-on-surface">
                لا توجد مركبات متاحة للحجز المباشر في الفترة التي اخترتها.
              </p>
              <p className="mt-2 text-on-surface-variant">
                جرّب تغيير التواريخ أو تصفح الأسطول كاملاً بدون فلترة التوفر.
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
