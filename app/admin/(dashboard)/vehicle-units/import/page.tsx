import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { requireAdminPage } from "@/lib/admin-page";
import { adminScope, listScopedBranches } from "@/lib/admin-scope";
import { prisma } from "@/lib/prisma";
import { VehicleUnitImportClient } from "./VehicleUnitImportClient";

export const dynamic = "force-dynamic";

export default async function VehicleUnitImportPage() {
  const scope = adminScope(await requireAdminPage());

  const [modelsRaw, branches] = await Promise.all([
    prisma.carModel.findMany({
      include: { brand: { select: { name: true } } },
      orderBy: [{ brand: { name: "asc" } }, { name: "asc" }, { year: "asc" }],
    }),
    listScopedBranches(scope),
  ]);

  const carModels = modelsRaw.map((m) => ({
    id: m.id,
    label: `${m.brand.name} ${m.name} (${m.year})`,
  }));

  return (
    <>
      <AdminPageHeader
        title="استيراد لوحات السيارات من Excel"
        backHref="/admin/vehicle-units"
        backLabel="إدارة لوحات السيارات"
        description={
          <>
            ارفع ملف <span className="font-bold text-on-surface">xlsx / csv</span> فيه أرقام
            اللوحات ثم حدد أي عمود يقابل كل حقل. الموديل يُطابَق بالماركة والاسم والسنة — أو
            اختر موديلاً افتراضياً للملف كله. اللوحة المسجّلة مسبقاً تُحدَّث ولا تُكرَّر.
          </>
        }
      />

      <VehicleUnitImportClient carModels={carModels} branches={branches} />
    </>
  );
}
