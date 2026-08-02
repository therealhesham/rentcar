import { branchWhereForScope, type AdminScope } from "@/lib/admin-scope";
import { prisma } from "@/lib/prisma";

export type VehicleUnitListItem = {
  id: number;
  plateNumber: string;
  chassisNumber: string | null;
  color: string | null;
  carModelId: number;
  carModelName: string;
  brandName: string;
  branchId: number | null;
  branchName: string | null;
  status: string;
  notes: string | null;
  bookingsCount: number;
  maintenanceCount: number;
  /// هل توجد عملية صيانة جارية (لم تُغلق بعد) على هذه اللوحة
  hasOpenMaintenance: boolean;
  createdAt: Date;
};

/** قائمة لوحات وحدات السيارات التابعة لموديل معين (مفوترة بحسب الفرع اختيراياً) */
export async function getVehicleUnitOptionsForModel(modelId: number, branchId?: number | null) {
  try {
    const units = await prisma.vehicleUnit.findMany({
      where: {
        carModelId: modelId,
        status: { in: ["AVAILABLE", "RENTED"] },
        ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {}),
      },
      select: {
        id: true,
        plateNumber: true,
        color: true,
        status: true,
        branch: { select: { name: true } },
      },
      orderBy: [{ status: "asc" }, { plateNumber: "asc" }],
    });
    return units;
  } catch {
    return [];
  }
}

/** استعلام شامل عن جميع وحدات السيارات بالأسطول لصفحة الإدارة */
export async function listAllVehicleUnits(
  scope: AdminScope = { kind: "all" },
): Promise<VehicleUnitListItem[]> {
  try {
    const branchWhere = branchWhereForScope(scope);
    const rows = await prisma.vehicleUnit.findMany({
      where:
        Object.keys(branchWhere).length === 0 ? {} : { branch: branchWhere },
      include: {
        carModel: {
          select: {
            name: true,
            brand: { select: { name: true } },
          },
        },
        branch: { select: { name: true } },
        _count: { select: { bookingRequests: true, maintenanceLogs: true } },
        maintenanceLogs: {
          where: { status: "IN_PROGRESS" },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: [{ carModel: { name: "asc" } }, { plateNumber: "asc" }],
    });

    return rows.map((r) => ({
      id: r.id,
      plateNumber: r.plateNumber,
      chassisNumber: r.chassisNumber,
      color: r.color,
      carModelId: r.carModelId,
      carModelName: r.carModel.name,
      brandName: r.carModel.brand.name,
      branchId: r.branchId,
      branchName: r.branch?.name ?? null,
      status: r.status,
      notes: r.notes,
      bookingsCount: r._count.bookingRequests,
      maintenanceCount: r._count.maintenanceLogs,
      hasOpenMaintenance: r.maintenanceLogs.length > 0,
      createdAt: r.createdAt,
    }));
  } catch {
    return [];
  }
}
