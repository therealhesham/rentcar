import { redirect } from "@/i18n/routing";
import { Suspense } from "react";
import { FleetCheckoutClient } from "@/components/fleet/FleetCheckoutClient";
import { CarViewTracker } from "@/components/fleet/CarViewTracker";
import { getCarModelForCheckout } from "@/lib/checkout-car-data";
import { getActiveBranches, getActiveBookingCitiesWithBranches } from "@/lib/branch-data";
import { getCustomerProfile } from "@/lib/customer-auth";
import { e164ToLocalNine } from "@/lib/normalize-saudi-phone";
import { getActiveRentalAddons } from "@/lib/rental-addon-data";
import { getKycDocRequirements, getRentalPriceDisplayMode } from "@/lib/site-settings";
import { getActiveInterCityShippingRules } from "@/lib/inter-city-shipping";
import { getActiveRentalTerms } from "@/lib/rental-terms-data";
import { getActiveCheckoutOneTimeFees } from "@/lib/checkout-one-time-fees";
import { loadFleetCheckoutEditPrefill } from "@/lib/fleet-checkout-edit-prefill";
import { buildFleetSearchUrlHydrate } from "@/lib/fleet-search-url-hydrate";
import { getBookingWidgetTabFlags } from "@/lib/site-settings";
import { buildPageMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

export const metadata = buildPageMetadata({
  title: "إتمام الحجز",
  description: "مراجعة السعر والإضافات وإتمام حجز السيارة.",
  noIndex: true,
});

function firstSearchParam(
  v: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function FleetCheckoutPage({
  searchParams,
  params: routeParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
  params: Promise<{ locale: string }>;
}) {
  const { locale } = await routeParams;
  const sp = searchParams ? await searchParams : {};
  const modelId = Number(firstSearchParam(sp.modelId));
  if (!Number.isInteger(modelId) || modelId < 1) {
    redirect({ href: "/fleet", locale });
  }

  const checkoutBranchSlug =
    firstSearchParam(sp.returnBranch)?.toLowerCase() ??
    firstSearchParam(sp.pickupBranch)?.toLowerCase() ??
    firstSearchParam(sp.branch)?.toLowerCase() ??
    null;
  const checkoutPickupRaw = firstSearchParam(sp.pickup);
  let checkoutPickupDate: Date | null = null;
  if (checkoutPickupRaw) {
    const d = new Date(checkoutPickupRaw);
    if (!Number.isNaN(d.getTime())) checkoutPickupDate = d;
  }

  const [
    car,
    addons,
    branchRows,
    bookingCities,
    profile,
    rentalPriceDisplayMode,
    interCityShippingRules,
    checkoutOneTimeFees,
    tabFlags,
    rentalTerms,
    kycDocFlags,
  ] = await Promise.all([
    getCarModelForCheckout(modelId, {
      branchSlug: checkoutBranchSlug,
      pickupDate: checkoutPickupDate,
    }),
    getActiveRentalAddons(locale),
    getActiveBranches(locale).catch(() => []),
    getActiveBookingCitiesWithBranches(locale).catch(() => []),
    getCustomerProfile(),
    getRentalPriceDisplayMode(),
    getActiveInterCityShippingRules().catch(() => []),
    getActiveCheckoutOneTimeFees(locale).catch(() => []),
    getBookingWidgetTabFlags(),
    getActiveRentalTerms(locale),
    getKycDocRequirements(),
  ]);

  const fleetUrlHydrate = buildFleetSearchUrlHydrate(sp);

  if (!car) {
    redirect({ href: "/fleet", locale });
    return null;
  }

  const branchBySlug: Record<string, string> = {};
  for (const b of branchRows) {
    branchBySlug[b.slug] = b.name;
  }
  if (Object.keys(branchBySlug).length === 0) {
    branchBySlug.jeddah = "جدة";
    branchBySlug.madinah = "المدينة المنورة";
    branchBySlug.tabuk = "تبوك";
  }

  const phoneLocal = profile?.phone ? e164ToLocalNine(profile.phone) : null;
  const profileNameTrimmed = profile?.name?.trim() ?? "";
  const sessionCustomer =
    profile && profileNameTrimmed.length >= 3 && phoneLocal
      ? {
          name: profileNameTrimmed,
          phoneLocal,
          email: profile.email,
          idDocumentKind: profile.idDocumentKind,
          nationalIdNumber: profile.nationalIdNumber,
          passportNumber: profile.passportNumber,
          licenseNumber: profile.licenseNumber,
          licenseExpiryYmd:
            profile.licenseExpiryDate && !Number.isNaN(profile.licenseExpiryDate.getTime())
              ? profile.licenseExpiryDate.toISOString().slice(0, 10)
              : null,
          idCardImageUrl: profile.idCardImageUrl,
          driverLicenseImageUrl: profile.driverLicenseImageUrl,
        }
      : null;

  const excludeRaw = firstSearchParam(sp.excludeBookingRequestId)?.trim();
  const prefillRaw = firstSearchParam(sp.prefillBookingRequestId)?.trim();
  const excludeParsed = excludeRaw ? Number(excludeRaw) : NaN;
  const prefillParsed = prefillRaw ? Number(prefillRaw) : NaN;
  const excludeBookingRequestId =
    Number.isInteger(excludeParsed) && excludeParsed >= 1 ? excludeParsed : undefined;
  const prefillBookingRequestId =
    Number.isInteger(prefillParsed) && prefillParsed >= 1 ? prefillParsed : undefined;

  const bookingIdForPrefill = excludeBookingRequestId ?? prefillBookingRequestId;

  const editPrefill =
    profile && bookingIdForPrefill != null
      ? await loadFleetCheckoutEditPrefill({
          profile,
          carModelId: modelId,
          bookingRequestId: bookingIdForPrefill,
        })
      : null;

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f4f4f5] pt-24 text-on-surface">
          <p className="text-sm font-bold text-on-surface-variant">جاري التحميل…</p>
        </div>
      }
    >
      <CarViewTracker carModelId={car.modelId} />
      <FleetCheckoutClient
        car={car}
        addons={addons}
        branchBySlug={branchBySlug}
        bookingCities={bookingCities}
        interCityShippingRules={interCityShippingRules}
        checkoutOneTimeFees={checkoutOneTimeFees}
        sessionCustomer={sessionCustomer}
        rentalPriceDisplayMode={rentalPriceDisplayMode}
        editPrefill={editPrefill}
        tabFlags={tabFlags}
        fleetUrlHydrate={fleetUrlHydrate}
        rentalTerms={rentalTerms}
        kycDocFlags={kycDocFlags}
      />
    </Suspense>
  );
}
