import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { FleetCheckoutClient } from "@/components/fleet/FleetCheckoutClient";
import { getCarModelForCheckout } from "@/lib/checkout-car-data";
import { getActiveBranches, getActiveBookingCitiesWithBranches } from "@/lib/branch-data";
import { getCustomerProfile } from "@/lib/customer-auth";
import { e164ToLocalNine } from "@/lib/normalize-saudi-phone";
import { getActiveRentalAddons } from "@/lib/rental-addon-data";
import { getRentalPriceDisplayMode } from "@/lib/site-settings";
import { getActiveInterCityShippingRules } from "@/lib/inter-city-shipping";
import { getActiveCheckoutOneTimeFees } from "@/lib/checkout-one-time-fees";
import { loadFleetCheckoutEditPrefill } from "@/lib/fleet-checkout-edit-prefill";
import { buildFleetSearchUrlHydrate } from "@/lib/fleet-search-url-hydrate";
import { getBookingWidgetTabFlags } from "@/lib/site-settings";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "إتمام الحجز | Rawaes",
  description: "مراجعة السعر والإضافات وإتمام حجز السيارة.",
};

function firstSearchParam(
  v: string | string[] | undefined,
): string | undefined {
  if (Array.isArray(v)) return v[0];
  return v;
}

export default async function FleetCheckoutPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = searchParams ? await searchParams : {};
  const modelId = Number(firstSearchParam(sp.modelId));
  if (!Number.isInteger(modelId) || modelId < 1) {
    redirect("/fleet");
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
  ] = await Promise.all([
    getCarModelForCheckout(modelId),
    getActiveRentalAddons(),
    getActiveBranches().catch(() => []),
    getActiveBookingCitiesWithBranches().catch(() => []),
    getCustomerProfile(),
    getRentalPriceDisplayMode(),
    getActiveInterCityShippingRules().catch(() => []),
    getActiveCheckoutOneTimeFees().catch(() => []),
    getBookingWidgetTabFlags(),
  ]);

  const fleetUrlHydrate = buildFleetSearchUrlHydrate(sp);

  if (!car) {
    redirect("/fleet");
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
      />
    </Suspense>
  );
}
