import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { FleetCheckoutClient } from "@/components/fleet/FleetCheckoutClient";
import { getCarModelForCheckout } from "@/lib/checkout-car-data";
import { getActiveBranches, getActiveBookingCitiesWithBranches } from "@/lib/branch-data";
import { getCustomerProfile } from "@/lib/customer-auth";
import { e164ToLocalNine } from "@/lib/normalize-saudi-phone";
import { getActiveRentalAddons } from "@/lib/rental-addon-data";
import { getRentalPriceDisplayMode, getBookingOtpChannel } from "@/lib/site-settings";
import { getActiveInterCityShippingRules } from "@/lib/inter-city-shipping";
import { getActiveCheckoutOneTimeFees } from "@/lib/checkout-one-time-fees";
import { isBookingCheckoutOtpStepRequired } from "@/lib/booking-checkout-otp";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "إتمام الحجز | Rawaes",
  description: "مراجعة السعر والإضافات وإتمام حجز السيارة.",
};

export default async function FleetCheckoutPage({
  searchParams,
}: {
  searchParams?: Promise<{ modelId?: string }>;
}) {
  const sp = searchParams ? await searchParams : {};
  const modelId = Number(sp.modelId);
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
    bookingOtpChannel,
    bookingCheckoutOtpRequired,
  ] = await Promise.all([
    getCarModelForCheckout(modelId),
    getActiveRentalAddons(),
    getActiveBranches().catch(() => []),
    getActiveBookingCitiesWithBranches().catch(() => []),
    getCustomerProfile(),
    getRentalPriceDisplayMode(),
    getActiveInterCityShippingRules().catch(() => []),
    getActiveCheckoutOneTimeFees().catch(() => []),
    getBookingOtpChannel(),
    isBookingCheckoutOtpStepRequired(),
  ]);

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
        bookingOtpChannel={bookingOtpChannel}
        bookingCheckoutOtpRequired={bookingCheckoutOtpRequired}
      />
    </Suspense>
  );
}
