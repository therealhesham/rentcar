import { notFound } from "next/navigation";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { requireAdminPage } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";
import { getVehicleLog } from "@/lib/vehicle-log";
import { VehicleLogView } from "./VehicleLogView";

export const dynamic = "force-dynamic";

export default async function VehicleLogPage({
  params,
}: {
  params: Promise<{ unitId: string }>;
}) {
  await requireAdminPage();

  const { unitId } = await params;
  const id = Number(unitId);
  if (!Number.isInteger(id) || id < 1) notFound();

  const [log, branches] = await Promise.all([
    getVehicleLog(id),
    prisma.branch.findMany({
      where: { isActive: true },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
  ]);

  if (!log) notFound();

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={`سجل السيارة — ${log.unit.plateNumber}`}
        description={`${log.unit.brandName} ${log.unit.carModelName} (${log.unit.carModelYear}) — كل الحجوزات وعمليات الصيانة المسجَّلة على هذه اللوحة.`}
        backHref="/admin/vehicle-units"
        backLabel="لوحات السيارات"
      />
      <VehicleLogView log={log} branches={branches} />
    </div>
  );
}
