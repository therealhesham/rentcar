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
        status: { not: "INACTIVE" },
        ...(branchId ? { OR: [{ branchId }, { branchId: null }] } : {}),
      },
      select: {
        id: true,
        plateNumber: true,
        color: true,
        status: true,
        branch: { select: { name: true } },
        maintenanceLogs: {
          where: { status: "IN_PROGRESS" },
          select: { id: true },
          take: 1,
        },
        bookingRequests: {
          where: {
            OR: [
              { status: "PICKED_UP" },
              { vehiclePickedUpAt: { not: null }, vehicleReturnedAt: null },
            ],
          },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: [{ status: "asc" }, { plateNumber: "asc" }],
    });

    return units.map((u) => {
      const hasOpenMaintenance = u.maintenanceLogs.length > 0;
      const hasActiveRental = u.bookingRequests.length > 0;

      let realStatus = u.status;
      if (u.status !== "INACTIVE") {
        if (hasOpenMaintenance) realStatus = "MAINTENANCE";
        else if (hasActiveRental) realStatus = "RENTED";
        else realStatus = "AVAILABLE";
      }

      return {
        id: u.id,
        plateNumber: u.plateNumber,
        color: u.color,
        status: realStatus,
        branch: u.branch,
      };
    });
  } catch {
    return [];
  }
}

/** استعلام شامل عن جميع وحدات السيارات بالأسطول لصفحة الإدارة بدلالة الحالة الحقيقية المباشرة من النظام */
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
        bookingRequests: {
          where: {
            OR: [
              { status: "PICKED_UP" },
              { vehiclePickedUpAt: { not: null }, vehicleReturnedAt: null },
            ],
          },
          select: { id: true },
          take: 1,
        },
      },
      orderBy: [{ carModel: { name: "asc" } }, { plateNumber: "asc" }],
    });

    const staleStatusUpdates: { id: number; status: string }[] = [];

    const items = rows.map((r) => {
      const hasOpenMaintenance = r.maintenanceLogs.length > 0;
      const hasActiveRental = r.bookingRequests.length > 0;

      let realStatus = r.status;
      if (r.status !== "INACTIVE") {
        if (hasOpenMaintenance) {
          realStatus = "MAINTENANCE";
        } else if (hasActiveRental) {
          realStatus = "RENTED";
        } else {
          realStatus = "AVAILABLE";
        }
      }

      if (realStatus !== r.status) {
        staleStatusUpdates.push({ id: r.id, status: realStatus });
      }

      return {
        id: r.id,
        plateNumber: r.plateNumber,
        chassisNumber: r.chassisNumber,
        color: r.color,
        carModelId: r.carModelId,
        carModelName: r.carModel.name,
        brandName: r.carModel.brand.name,
        branchId: r.branchId,
        branchName: r.branch?.name ?? null,
        status: realStatus,
        notes: r.notes,
        bookingsCount: r._count.bookingRequests,
        maintenanceCount: r._count.maintenanceLogs,
        hasOpenMaintenance,
        createdAt: r.createdAt,
      };
    });

    // تحديث وتزامن أية حالات قديمة في قاعدة البيانات تلقائياً
    if (staleStatusUpdates.length > 0) {
      Promise.all(
        staleStatusUpdates.map((u) =>
          prisma.vehicleUnit.update({
            where: { id: u.id },
            data: { status: u.status },
          }).catch(() => null)
        )
      ).catch(() => null);
    }

    return items;
  } catch {
    return [];
  }
}

