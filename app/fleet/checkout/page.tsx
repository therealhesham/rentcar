import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { FleetCheckoutClient } from "@/components/fleet/FleetCheckoutClient";
import { getCarModelForCheckout } from "@/lib/checkout-car-data";
import { getActiveBranches } from "@/lib/branch-data";
import { getActiveRentalAddons } from "@/lib/rental-addon-data";

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

  const [car, addons, branchRows] = await Promise.all([
    getCarModelForCheckout(modelId),
    getActiveRentalAddons(),
    getActiveBranches().catch(() => []),
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

  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#f4f4f5] pt-24 text-on-surface">
          <p className="text-sm font-bold text-on-surface-variant">جاري التحميل…</p>
        </div>
      }
    >
      <FleetCheckoutClient car={car} addons={addons} branchBySlug={branchBySlug} />
    </Suspense>
  );
}
