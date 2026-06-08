import Link from "next/link";
import { Fuel, Zap, Leaf, Droplets } from "lucide-react";
import { BranchFleetQuantityForm } from "@/components/admin/BranchFleetQuantityForm";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { SuperAdminVehiclesTable } from "@/components/admin/SuperAdminVehiclesTable";
import { InlineVehicleEditForm } from "@/components/admin/InlineVehicleEditForm";
import { InlineCategoryEditForm } from "@/components/admin/InlineCategoryEditForm";
import { requireAdminPage } from "@/lib/admin-page";
import {
  listFleetVehiclesForAdmin,
  listFleetVehiclesForSuperAdmin,
} from "@/lib/fleet-vehicle-admin-data";
import { prisma } from "@/lib/prisma";
import { SarAmountWithSymbol } from "@/components/ui/SarAmountWithSymbol";
import type { FuelType, Transmission } from "@prisma/client";

// ─── Fuel pill (server-component-safe) ──────────────────────────────────────
const FUEL_ICON_MAP: Record<FuelType, React.ElementType> = {
  GASOLINE: Fuel,
  DIESEL: Droplets,
  HYBRID: Leaf,
  ELECTRIC: Zap,
};
const FUEL_LABEL_MAP: Record<FuelType, string> = {
  GASOLINE: "بنزين",
  DIESEL: "ديزل",
  HYBRID: "هجين",
  ELECTRIC: "كهرباء",
};
const FUEL_COLOR_MAP: Record<FuelType, string> = {
  GASOLINE: "bg-orange-50  text-orange-700  border-orange-200",
  DIESEL:   "bg-slate-50   text-slate-700   border-slate-200",
  HYBRID:   "bg-emerald-50 text-emerald-700 border-emerald-200",
  ELECTRIC: "bg-blue-50    text-blue-700    border-blue-200",
};
const TRANS_LABEL_MAP: Record<Transmission, string> = {
  AUTOMATIC: "أوتو",
  MANUAL: "يدوي",
};

function BranchFuelPill({
  fuel,
  transmission,
}: {
  fuel: FuelType;
  transmission: Transmission;
}) {
  const Icon = FUEL_ICON_MAP[fuel];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold ${FUEL_COLOR_MAP[fuel]}`}
    >
      <Icon className="h-3 w-3 shrink-0" aria-hidden />
      {FUEL_LABEL_MAP[fuel]}
      <span className="text-[10px] opacity-60">· {TRANS_LABEL_MAP[transmission]}</span>
    </span>
  );
}

export const dynamic = "force-dynamic";


export default async function AdminVehiclesPage() {
  const session = await requireAdminPage();
  const readOnly = !session.isSuperAdmin;
  const branchId = session.branchId;

  if (session.isSuperAdmin) {
    const { branches, categories, vehicles } = await listFleetVehiclesForSuperAdmin();

    return (
      <>
        <AdminPageHeader
          title="السيارات والأسطول"
          description={
            <>
              كل صف = موديل سيارة. الأعمدة تعرض{" "}
              <span className="font-bold text-on-surface">الكمية في كل فرع</span> — يمكنك
              تعديلها مباشرة أو فتح «تعديل» لتغيير السعر والصورة. التوفر عند الحجز يُحسب من
              مخزون فرع الإرجاع فقط.
            </>
          }
          actions={
            <>
              <Link
                href="/admin/vehicles/import"
                className="rounded-xl border border-outline-variant px-5 py-3 text-sm font-extrabold text-primary transition-colors hover:bg-surface-container"
              >
                استيراد من Excel
              </Link>
              <Link
                href="/admin/vehicles/new"
                className="gradient-cta rounded-xl px-6 py-3 text-sm font-extrabold text-white shadow-[0_8px_20px_-8px_rgba(119,89,39,0.45)]"
              >
                إضافة مركبة
              </Link>
            </>
          }
        />

        {vehicles.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-outline-variant/50 bg-surface-container-low/50 px-8 py-14 text-center">
            <p className="text-lg font-bold text-on-surface">لا توجد مركبات في الكتالوج بعد.</p>
            <p className="mt-2 text-on-surface-variant">
              ابدأ من{" "}
              <Link href="/admin/vehicles/new" className="font-bold text-primary hover:underline">
                إضافة مركبة
              </Link>
              .
            </p>
          </div>
        ) : (
          <SuperAdminVehiclesTable branches={branches} categories={categories} vehicles={vehicles} />
        )}
      </>
    );
  }

  const [{ categories, vehicles }, branchRow] = await Promise.all([
    listFleetVehiclesForAdmin(branchId),
    branchId
      ? prisma.branch.findFirst({
          where: { id: branchId },
          select: { name: true, slug: true },
        })
      : Promise.resolve(null),
  ]);

  const branchBookingCounts = branchRow?.slug
    ? await prisma.bookingRequest.groupBy({
        by: ["carModelId"],
        where: {
          returnBranch: { slug: branchRow.slug },
          carModelId: { not: null },
          kind: "DIRECT",
        },
        _count: { _all: true },
      })
    : [];

  const bookingsByModel = new Map(
    branchBookingCounts
      .filter((r) => r.carModelId != null)
      .map((r) => [r.carModelId!, r._count._all]),
  );

  return (
    <>
      <AdminPageHeader
        title="أسطول الفرع"
        description={
          branchRow ? (
            <>
              حدّد <span className="font-bold text-on-surface">كمية كل مركبة</span> المتاحة في فرع{" "}
              <span className="font-bold text-on-surface">{branchRow.name}</span>. التوفر عند الحجز
              يُحسب من هذا الرقم ومن الحجوزات النشطة في الفرع.
            </>
          ) : (
            "حسابك غير مرتبط بفرع."
          )
        }
      />

      {vehicles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-outline-variant/50 bg-surface-container-low/50 px-8 py-14 text-center">
          <p className="text-lg font-bold text-on-surface">لا توجد مركبات في الكتالوج بعد.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-outline-variant/30 bg-surface-container-lowest shadow-sm">
          <table className="min-w-full border-collapse text-start text-sm">
            <thead>
              <tr className="border-b border-outline-variant/40 bg-surface-container-low">
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">صورة</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">المركبة</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">النوع</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-on-surface-variant">السنة</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-on-surface-variant">المقاعد</th>
                <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">الوقود</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-on-surface-variant">السعر / يوم</th>
                <th className="px-4 py-3 text-center text-xs font-bold uppercase tracking-wider text-on-surface-variant">الكمية في فرعك</th>
                {branchRow ? (
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">حجوزات الفرع</th>
                ) : null}
                {branchId ? (
                  <th className="px-4 py-3 text-xs font-bold uppercase tracking-wider text-on-surface-variant">تحديث الكمية</th>
                ) : null}
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/15">
              {vehicles.map((v) => (
                <tr key={v.id} className="group/row transition-colors hover:bg-surface-container-low/50">

                  {/* Image */}
                  <td className="px-4 py-3">
                    <div className="relative h-14 w-24 overflow-hidden rounded-xl border border-outline-variant/30 bg-surface-container shadow-sm">
                      {v.image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={v.image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="flex h-full items-center justify-center text-lg text-on-surface-variant/30">
                          🚗
                        </span>
                      )}
                    </div>
                  </td>

                  {/* Name */}
                  <td className="px-4 py-3">
                    <Link
                      href={`/admin/vehicles/${v.id}/edit`}
                      className="group inline-flex flex-col"
                    >
                      <span className="whitespace-nowrap font-bold text-on-surface transition-colors group-hover:text-primary">
                        {v.brandName}
                        <span className="mx-1 text-on-surface-variant/50">|</span>
                        {v.modelName}
                      </span>
                      <span className="mt-0.5 text-[11px] font-bold text-primary opacity-0 transition-opacity group-hover:opacity-100">
                        تعديل ←
                      </span>
                    </Link>
                  </td>

                  {/* Category */}
                  <td className="px-4 py-3 text-center">
                    <InlineCategoryEditForm
                      modelId={v.id}
                      defaultValue={v.categoryId}
                      categories={categories}
                    />
                  </td>

                  {/* Year */}
                  <td className="px-4 py-3 text-center">
                    <InlineVehicleEditForm modelId={v.id} field="year" defaultValue={v.year} />
                  </td>

                  {/* Seats */}
                  <td className="px-4 py-3 text-center">
                    <InlineVehicleEditForm modelId={v.id} field="chairs" defaultValue={v.chairs} />
                  </td>

                  {/* Fuel */}
                  <td className="px-4 py-3">
                    <BranchFuelPill fuel={v.fuel} transmission={v.transmission} />
                  </td>

                  {/* Price */}
                  <td className="px-4 py-3 text-center">
                    <InlineVehicleEditForm modelId={v.id} field="price" defaultValue={v.price} />
                  </td>

                  {/* Quantity */}
                  <td className="px-4 py-3">
                    <span className={`inline-flex min-w-[2rem] justify-center rounded-full px-2.5 py-1 text-sm font-extrabold tabular-nums ${
                      v.quantity > 0 ? "bg-primary-container/40 text-primary" : "bg-surface-container text-on-surface-variant/50"
                    }`}>
                      {v.quantity}
                    </span>
                  </td>

                  {branchRow ? (
                    <td className="px-4 py-3 tabular-nums text-on-surface">
                      {bookingsByModel.get(v.id) ?? 0}
                    </td>
                  ) : null}
                  {branchId ? (
                    <td className="px-4 py-3">
                      <BranchFleetQuantityForm
                        modelId={v.id}
                        branchId={branchId}
                        defaultQuantity={v.quantity}
                      />
                    </td>
                  ) : null}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
