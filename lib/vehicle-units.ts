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
export async function listAllVehicleUnits(): Promise<VehicleUnitListItem[]> {
  try {
    const rows = await prisma.vehicleUnit.findMany({
      include: {
        carModel: {
          select: {
            name: true,
            brand: { select: { name: true } },
          },
        },
        branch: { select: { name: true } },
        _count: { select: { bookingRequests: true } },
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
      createdAt: r.createdAt,
    }));
  } catch {
    return [];
  }
}

/** جلب بيانات سجل تفصيلي لوحدة سيارة محددة برقم اللوحة أو الـ ID مع كل الحجوزات السابقة */
export async function getVehicleUnitHistory(plateNumberOrId: string | number) {
  try {
    const where = typeof plateNumberOrId === "number"
      ? { id: plateNumberOrId }
      : { plateNumber: String(plateNumberOrId).trim() };

    const unit = await prisma.vehicleUnit.findFirst({
      where,
      include: {
        carModel: {
          select: {
            id: true,
            name: true,
            year: true,
            brand: { select: { name: true } },
          },
        },
        branch: { select: { id: true, name: true } },
        bookingRequests: {
          include: {
            customer: { select: { name: true, phone: true } },
            pickupBranch: { select: { name: true } },
            returnBranch: { select: { name: true } },
          },
          orderBy: { createdAt: "desc" },
        },
      },
    });

    if (!unit) return null;

    return {
      id: unit.id,
      plateNumber: unit.plateNumber,
      chassisNumber: unit.chassisNumber,
      color: unit.color,
      carModel: unit.carModel,
      branch: unit.branch,
      status: unit.status,
      notes: unit.notes,
      totalBookingsCount: unit.bookingRequests.length,
      bookings: unit.bookingRequests.map((b) => ({
        id: b.id,
        customerName: b.fullName || b.customer?.name || "عميل بدون اسم",
        phone: b.phone || b.customer?.phone || "—",
        pickupDate: b.pickupDate,
        numberOfDays: b.numberOfDays,
        status: b.status,
        pickupBranchName: b.pickupBranch?.name ?? "—",
        returnBranchName: b.returnBranch?.name ?? "—",
        vehiclePickedUpAt: b.vehiclePickedUpAt,
        vehicleReturnedAt: b.vehicleReturnedAt,
        createdAt: b.createdAt,
      })),
    };
  } catch {
    return null;
  }
}
