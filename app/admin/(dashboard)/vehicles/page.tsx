import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminVehiclesTable } from "@/components/admin/AdminVehiclesTable";
import { requireAdminPage } from "@/lib/admin-page";
import {
  listFleetVehiclesForAdmin,
  listFleetVehiclesForSuperAdmin,
} from "@/lib/fleet-vehicle-admin-data";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminVehiclesPage() {
  const session = await requireAdminPage();
  const branchId = session.branchId;

  if (session.isSuperAdmin) {
    const { branches, categories, vehicles } = await listFleetVehiclesForSuperAdmin();

    // Map vehicles to unified shape for the table component
    const mappedVehicles = vehicles.map((v) => ({
      id: v.id,
      brandName: v.brandName,
      modelName: v.modelName,
      categoryId: v.categoryId,
      categoryTitle: v.categoryTitle,
      year: v.year,
      chairs: v.chairs,
      price: v.price,
      priceMonthlyExclTax: v.priceMonthlyExclTax,
      fuel: v.fuel,
      transmission: v.transmission,
      image: v.image,
      quantity: v.totalQuantity,
      branchQuantities: v.branchQuantities,
    }));

    return (
      <>
        <AdminPageHeader
          title="السيارات والأسطول"
          description={
            <>
              كل صف = موديل سيارة. يمكنك إدارة{" "}
              <span className="font-bold text-on-surface">كمية وتوزيع السيارات في الفروع</span>، وتعديل
              المواصفات والأسعار مباشرة. التوفر عند الحجز يُحسب من مخزون فرع الإرجاع فقط.
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
          <AdminVehiclesTable
            isSuperAdmin={true}
            branches={branches}
            categories={categories}
            vehicles={mappedVehicles}
          />
        )}
      </>
    );
  }

  // Branch Admin path
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

  const mappedVehicles = vehicles.map((v) => ({
    id: v.id,
    brandName: v.brandName,
    modelName: v.modelName,
    categoryId: v.categoryId,
    categoryTitle: v.categoryTitle,
    year: v.year,
    chairs: v.chairs,
    price: v.price,
    priceMonthlyExclTax: v.priceMonthlyExclTax,
    fuel: v.fuel,
    transmission: v.transmission,
    image: v.image,
    quantity: v.quantity, // Branch quantity
    branchPricePerDayExclTax: v.branchPricePerDayExclTax ?? null,
    branchPriceMonthlyExclTax: v.branchPriceMonthlyExclTax ?? null,
    bookingCount: bookingsByModel.get(v.id) ?? 0,
  }));

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
        <AdminVehiclesTable
          isSuperAdmin={false}
          branchId={branchId}
          branchName={branchRow?.name}
          branches={[]}
          categories={categories}
          vehicles={mappedVehicles}
        />
      )}
    </>
  );
}
