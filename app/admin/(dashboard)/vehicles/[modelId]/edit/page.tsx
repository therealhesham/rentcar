import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Car, ExternalLink, ArrowRight } from "lucide-react";
import { verifyAdminSession } from "@/lib/admin-auth";
import { VehicleEditForm } from "@/components/admin/VehicleEditForm";
import { getFleetVehicleForAdminEdit } from "@/lib/fleet-vehicle-admin-data";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ modelId: string }>;
};

export default async function AdminVehicleEditPage({ params }: PageProps) {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const { modelId: raw } = await params;
  const id = Number(raw);
  if (!Number.isFinite(id) || id < 1) {
    notFound();
  }

  const vehicle = await getFleetVehicleForAdminEdit(id);
  if (!vehicle) {
    notFound();
  }

  return (
    <div dir="rtl">
      {/* ── Page header ── */}
      <header className="mb-8">
        {/* Back link */}
        <Link
          href="/admin/vehicles"
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-bold text-[#775927] transition-colors hover:text-[#5d4211]"
        >
          <ArrowRight className="h-4 w-4 rotate-180" aria-hidden />
          المركبات والأسطول
        </Link>

        {/* Title row */}
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[#775927]/10 text-[#775927]">
              <Car className="h-5 w-5" aria-hidden />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-[#1c1b1b] sm:text-3xl">
                {vehicle.brandName} — {vehicle.name}
              </h1>
              <p className="mt-0.5 text-sm text-[#4e453a]">
                {vehicle.categoryTitle} · {vehicle.year}
              </p>
            </div>
          </div>

          {/* Fleet page link */}
          <Link
            href="/fleet"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-xl border border-[#d2c4b5] bg-white px-4 py-2.5 text-sm font-bold text-[#775927] transition-colors hover:bg-[#f6f3f2]"
          >
            <ExternalLink className="h-4 w-4" aria-hidden />
            صفحة الأسطول
          </Link>
        </div>

        {/* Divider */}
        <div className="mt-6 h-px bg-[#d2c4b5]/50" />
      </header>

      {/* ── Form ── */}
      <VehicleEditForm vehicle={vehicle} />
    </div>
  );
}
