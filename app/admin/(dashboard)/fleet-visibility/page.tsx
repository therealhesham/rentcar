import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-page";
import { adminScope, fleetWhereForScope } from "@/lib/admin-scope";
import { prisma } from "@/lib/prisma";
import { NON_BLOCKING_BOOKING_STATUSES } from "@/lib/direct-booking";
import { FleetVisibilityClient } from "./FleetVisibilityClient";
import type { FleetVisibilityRow } from "./FleetVisibilityClient";

export const dynamic = "force-dynamic";

export default async function FleetVisibilityPage() {
  const session = await requireAdminPage();

  const scope = adminScope(session);

  // سجلات الأسطول داخل النطاق مرتّبة حسب الفرع ثم الترتيب
  const fleetRows = await prisma.fleet.findMany({
    where: {
      quantity: { gt: 0 },
      ...fleetWhereForScope(scope),
    },
    select: {
      id: true,
      quantity: true,
      isVisible: true,
      displayOrder: true,
      modelId: true,
      branchId: true,
      pricePerDayExclTax: true,
      model: {
        select: {
          id: true,
          name: true,
          year: true,
          price: true,
          image: true,
          alt: true,
          displayOrder: true,
          brand: { select: { name: true } },
        },
      },
      branch: { select: { name: true } },
    },
    orderBy: [{ model: { displayOrder: "asc" } }, { id: "asc" }],
  });

  // عدد الحجوزات النشطة لكل (modelId, branchId)
  const activeBookings = await prisma.bookingRequest.groupBy({
    by: ["carModelId", "branchId"],
    where: {
      kind: "DIRECT",
      carModelId: { not: null },
      branchId: { not: null },
      status: { notIn: [...NON_BLOCKING_BOOKING_STATUSES] },
    },
    _count: { id: true },
  });

  const bookingMap = new Map<string, number>();
  for (const b of activeBookings) {
    if (b.carModelId && b.branchId) {
      bookingMap.set(`${b.carModelId}_${b.branchId}`, b._count.id);
    }
  }

  const rows: FleetVisibilityRow[] = fleetRows.map((row) => {
    const key = `${row.modelId}_${row.branchId}`;
    // السعر الفعلي: override الفرع إن وُجد وإلا السعر الأساسي للموديل
    const effectivePrice = row.pricePerDayExclTax ?? row.model.price;
    return {
      id: row.id,
      modelId: row.model.id,
      modelDisplayOrder: row.model.displayOrder,
      modelName: `${row.model.brand.name} ${row.model.name}`,
      modelYear: row.model.year,
      modelImage: row.model.image ?? null,
      modelAlt: row.model.alt ?? null,
      branchName: row.branch.name,
      quantity: row.quantity,
      activeBookings: bookingMap.get(key) ?? 0,
      isVisible: row.isVisible,
      effectivePrice,
    };
  });
  // الترتيب من DB مطابق للعميل — لا داعي لـ sort إضافي

  const totalHidden = rows.filter((r) => !r.isVisible).length;

  return (
    <>
      <header className="mb-8">
        <h1 className="text-3xl font-extrabold tracking-tight">إتاحة السيارات</h1>
        <p className="mt-2 max-w-2xl text-on-surface-variant">
          تحكّم في ظهور المركبات للعملاء وترتيب عرضها في صفحة الأسطول. السيارات
          المخفيّة لا تظهر للعملاء حتى لو كانت متاحة.
        </p>
        <p className="mt-3 text-sm text-on-surface-variant">
          <Link href="/admin" className="font-bold text-primary hover:underline">
            لوحة التحكم
          </Link>
        </p>
      </header>

      {totalHidden > 0 && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-error/20 bg-error-container/20 px-4 py-3 text-sm text-on-error-container">
          <span className="text-lg">⚠</span>
          <span>
            <span className="font-bold">{totalHidden} مركبة</span> مخفيّة حالياً
            من العملاء.
          </span>
        </div>
      )}

      <div className="mb-4 rounded-xl border border-outline-variant/30 bg-surface-container-low px-4 py-3 text-sm text-on-surface-variant">
        <span className="font-medium text-on-surface">تلميح:</span> استخدم أزرار
        ↑ ↓ لإعادة ترتيب السيارات يدوياً، أو استخدم{" "}
        <span className="font-medium text-on-surface">ترتيب حسب السعر</span>{" "}
        للترتيب التلقائي. الترتيب يؤثر على ترتيب الظهور في صفحة الأسطول.
      </div>

      <FleetVisibilityClient rows={rows} />
    </>
  );
}
