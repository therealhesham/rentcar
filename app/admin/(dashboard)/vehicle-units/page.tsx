import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { requireAdminPage } from "@/lib/admin-page";
import { adminScope, listScopedBranches } from "@/lib/admin-scope";
import { listAllVehicleUnits } from "@/lib/vehicle-units";
import { prisma } from "@/lib/prisma";
import { VehicleUnitsManager } from "./VehicleUnitsManager";

export const dynamic = "force-dynamic";

export default async function AdminVehicleUnitsPage() {
  const scope = adminScope(await requireAdminPage());

  const [units, carModelsRaw, branchesRaw] = await Promise.all([
    listAllVehicleUnits(scope),
    prisma.carModel.findMany({
      include: { brand: { select: { name: true } } },
      orderBy: [{ brand: { name: "asc" } }, { name: "asc" }],
    }),
    listScopedBranches(scope),
  ]);

  const carModels = carModelsRaw.map((m) => ({
    id: m.id,
    name: `${m.name} (${m.year})`,
    brandName: m.brand.name,
  }));

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title="إدارة لوحات السيارات (وحدات الأسطول)"
        description="تسجيل أرقام لوحات السيارات الفعلية، تتبع حالة كل مركب وحجوزاتها السابقة."
      />
      <VehicleUnitsManager
        units={units}
        carModels={carModels}
        branches={branchesRaw}
      />
    </div>
  );
}
