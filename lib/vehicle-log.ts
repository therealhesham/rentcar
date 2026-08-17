import { prisma } from "@/lib/prisma";

/** حجز سابق على نفس اللوحة كما يظهر في سجل السيارة. */
export type VehicleLogBooking = {
  id: number;
  customerName: string;
  phone: string;
  status: string;
  paymentStatus: string;
  pickupDate: Date;
  numberOfDays: number;
  pickupBranchName: string | null;
  returnBranchName: string | null;
  vehiclePickedUpAt: Date | null;
  vehicleReturnedAt: Date | null;
  /** المبلغ المدفوع فعلياً، أو لقطة الإجمالي المستحق إن لم يُدفع بعد. */
  amountSar: number | null;
  createdAt: Date;
};

/** عملية صيانة على نفس اللوحة كما تظهر في سجل السيارة. */
export type VehicleLogMaintenance = {
  id: number;
  kind: string;
  status: string;
  description: string;
  startedAt: Date;
  completedAt: Date | null;
  costSar: number | null;
  vendorName: string | null;
  invoiceRef: string | null;
  odometerKm: number | null;
  nextDueDate: Date | null;
  nextDueOdometerKm: number | null;
  branchId: number | null;
  branchName: string | null;
  createdBy: string | null;
  notes: string | null;
};

export type VehicleLogData = {
  unit: {
    id: number;
    plateNumber: string;
    chassisNumber: string | null;
    color: string | null;
    status: string;
    notes: string | null;
    carModelId: number;
    carModelName: string;
    carModelYear: number;
    brandName: string;
    branchId: number | null;
    branchName: string | null;
    createdAt: Date;
  };
  bookings: VehicleLogBooking[];
  maintenance: VehicleLogMaintenance[];
  stats: {
    bookingsCount: number;
    /** الحجوزات التي سُلِّمت فيها السيارة فعلياً للعميل. */
    completedBookingsCount: number;
    /** مجموع أيام التأجير للحجوزات غير الملغاة. */
    totalRentalDays: number;
    /** إجمالي الإيرادات المحصَّلة من هذه اللوحة (شامل الضريبة). */
    totalRevenueSar: number;
    maintenanceCount: number;
    /** إجمالي تكلفة الصيانة المسجَّلة (تستبعد العمليات الملغاة). */
    totalMaintenanceCostSar: number;
    /** عدد عمليات الصيانة الجارية حالياً. */
    openMaintenanceCount: number;
    /** آخر قراءة عداد مسجَّلة في سجلات الصيانة. */
    lastOdometerKm: number | null;
    /** أقرب موعد صيانة قادم مسجَّل (تاريخ). */
    nextDueDate: Date | null;
    /** فات موعد الصيانة القادمة. */
    nextDueOverdue: boolean;
    nextDueOdometerKm: number | null;
  };
};

const CANCELLED_BOOKING_STATUSES = new Set(["CANCELLED", "REJECTED"]);

/**
 * سجل سيارة كامل لوحدة أسطول محددة (`VehicleUnit`): بيانات اللوحة + كل حجوزاتها
 * + كل عمليات صيانتها. يقبل معرّف الوحدة أو رقم اللوحة نفسه.
 */
export async function getVehicleLog(
  plateNumberOrId: string | number,
): Promise<VehicleLogData | null> {
  const where =
    typeof plateNumberOrId === "number"
      ? { id: plateNumberOrId }
      : { plateNumber: String(plateNumberOrId).trim() };

  const unit = await prisma.vehicleUnit.findFirst({
    where,
    include: {
      carModel: {
        select: { id: true, name: true, year: true, brand: { select: { name: true } } },
      },
      branch: { select: { id: true, name: true } },
      bookingRequests: {
        include: {
          customer: { select: { name: true, phone: true } },
          pickupBranch: { select: { name: true } },
          returnBranch: { select: { name: true } },
        },
        orderBy: { pickupDate: "desc" },
      },
      maintenanceLogs: {
        include: { branch: { select: { name: true } } },
        orderBy: { startedAt: "desc" },
      },
    },
  });

  if (!unit) return null;

  const bookings: VehicleLogBooking[] = unit.bookingRequests.map((b) => ({
    id: b.id,
    customerName: b.fullName || b.customer?.name || "عميل بدون اسم",
    phone: b.phone || b.customer?.phone || "—",
    status: b.status,
    paymentStatus: b.paymentStatus,
    pickupDate: b.pickupDate,
    numberOfDays: b.numberOfDays,
    pickupBranchName: b.pickupBranch?.name ?? null,
    returnBranchName: b.returnBranch?.name ?? null,
    vehiclePickedUpAt: b.vehiclePickedUpAt,
    vehicleReturnedAt: b.vehicleReturnedAt,
    amountSar: b.paidAmountSar ?? b.snapshotTotalAmountSar ?? null,
    createdAt: b.createdAt,
  }));

  const maintenance: VehicleLogMaintenance[] = unit.maintenanceLogs.map((m) => ({
    id: m.id,
    kind: m.kind,
    status: m.status,
    description: m.description,
    startedAt: m.startedAt,
    completedAt: m.completedAt,
    costSar: m.costSar,
    vendorName: m.vendorName,
    invoiceRef: m.invoiceRef,
    odometerKm: m.odometerKm,
    nextDueDate: m.nextDueDate,
    nextDueOdometerKm: m.nextDueOdometerKm,
    branchId: m.branchId,
    branchName: m.branch?.name ?? null,
    createdBy: m.createdBy,
    notes: m.notes,
  }));

  const activeBookings = bookings.filter((b) => !CANCELLED_BOOKING_STATUSES.has(b.status));
  const activeMaintenance = maintenance.filter((m) => m.status !== "CANCELLED");

  // آخر قراءة عداد = أحدث سجل صيانة يحمل قراءة (السجلات مرتَّبة تنازلياً بتاريخ البدء).
  const lastOdometerKm =
    activeMaintenance.find((m) => typeof m.odometerKm === "number")?.odometerKm ?? null;

  const nextDueDate =
    activeMaintenance
      .map((m) => m.nextDueDate)
      .filter((d): d is Date => d !== null)
      .sort((a, b) => a.getTime() - b.getTime())[0] ?? null;

  const hasOpenMaintenance = maintenance.some((m) => m.status === "IN_PROGRESS");
  const hasActiveRental = bookings.some(
    (b) => b.status === "PICKED_UP" || (b.vehiclePickedUpAt !== null && b.vehicleReturnedAt === null),
  );

  let realStatus = unit.status;
  if (unit.status !== "INACTIVE") {
    if (hasOpenMaintenance) {
      realStatus = "MAINTENANCE";
    } else if (hasActiveRental) {
      realStatus = "RENTED";
    } else {
      realStatus = "AVAILABLE";
    }
  }

  if (realStatus !== unit.status) {
    prisma.vehicleUnit.update({
      where: { id: unit.id },
      data: { status: realStatus },
    }).catch(() => null);
  }

  return {
    unit: {
      id: unit.id,
      plateNumber: unit.plateNumber,
      chassisNumber: unit.chassisNumber,
      color: unit.color,
      status: realStatus,
      notes: unit.notes,
      carModelId: unit.carModel.id,
      carModelName: unit.carModel.name,
      carModelYear: unit.carModel.year,
      brandName: unit.carModel.brand.name,
      branchId: unit.branchId,
      branchName: unit.branch?.name ?? null,
      createdAt: unit.createdAt,
    },

    bookings,
    maintenance,
    stats: {
      bookingsCount: bookings.length,
      completedBookingsCount: bookings.filter((b) => b.vehiclePickedUpAt !== null).length,
      totalRentalDays: activeBookings.reduce((sum, b) => sum + b.numberOfDays, 0),
      totalRevenueSar: bookings.reduce((sum, b) => sum + (b.amountSar ?? 0), 0),
      maintenanceCount: maintenance.length,
      totalMaintenanceCostSar: activeMaintenance.reduce((sum, m) => sum + (m.costSar ?? 0), 0),
      openMaintenanceCount: maintenance.filter((m) => m.status === "IN_PROGRESS").length,
      lastOdometerKm,
      nextDueDate,
      nextDueOverdue: nextDueDate !== null && nextDueDate.getTime() < Date.now(),
      nextDueOdometerKm:
        activeMaintenance.find((m) => typeof m.nextDueOdometerKm === "number")
          ?.nextDueOdometerKm ?? null,
    },
  };
}
