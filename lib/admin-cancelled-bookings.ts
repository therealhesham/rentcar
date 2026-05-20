import type { Prisma } from "@prisma/client";
import { bookingBranchWhere } from "@/lib/admin-access";
import type { AdminSession } from "@/lib/admin-auth";
import { addDaysToYmd } from "@/lib/direct-booking";
import { prisma } from "@/lib/prisma";

export type CancelledBookingsFilter = {
  q?: string;
};

export type CancelledBookingRow = {
  id: number;
  fullName: string;
  phone: string;
  pickupDate: Date;
  numberOfDays: number;
  cancelledAt: Date | null;
  updatedAt: Date;
  paymentStatus: string;
  paymentMethod: string | null;
  cancellationDeductedDays: number | null;
  cancellationRefundAmountSar: number | null;
  carLabel: string;
  pickupBranchName: string;
  returnBranchName: string;
  pickupMode: string | null;
};

function buildWhere(
  session: AdminSession,
  filter: CancelledBookingsFilter,
): Prisma.BookingRequestWhereInput {
  const extra: Prisma.BookingRequestWhereInput = {
    status: "CANCELLED",
    kind: "DIRECT",
  };
  const q = filter.q?.trim();
  if (q) {
    extra.OR = [
      { fullName: { contains: q } },
      { phone: { contains: q } },
      ...(/^\d+$/.test(q) ? [{ id: Number(q) }] : []),
    ];
  }
  return bookingBranchWhere(session, extra);
}

export async function loadCancelledBookings(
  session: AdminSession,
  filter: CancelledBookingsFilter,
  take = 200,
): Promise<CancelledBookingRow[]> {
  const rows = await prisma.bookingRequest.findMany({
    where: buildWhere(session, filter),
    orderBy: [{ cancelledAt: "desc" }, { updatedAt: "desc" }],
    take,
    include: {
      carModel: { include: { brand: true } },
      pickupBranch: { select: { name: true } },
      returnBranch: { select: { name: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    fullName: r.fullName,
    phone: r.phone,
    pickupDate: r.pickupDate,
    numberOfDays: r.numberOfDays,
    cancelledAt: r.cancelledAt,
    updatedAt: r.updatedAt,
    paymentStatus: r.paymentStatus,
    paymentMethod: r.paymentMethod,
    cancellationDeductedDays: r.cancellationDeductedDays,
    cancellationRefundAmountSar: r.cancellationRefundAmountSar,
    carLabel: r.carModel ? `${r.carModel.brand.name} ${r.carModel.name}` : r.carType || "—",
    pickupBranchName: r.pickupBranch?.name ?? "—",
    returnBranchName: r.returnBranch?.name ?? "—",
    pickupMode: r.pickupMode,
  }));
}

export async function countCancelledBookings(
  session: AdminSession,
  filter: CancelledBookingsFilter = {},
): Promise<number> {
  return prisma.bookingRequest.count({ where: buildWhere(session, filter) });
}

export function cancelledAtSortKey(row: CancelledBookingRow): string {
  const d = row.cancelledAt ?? row.updatedAt;
  return d.toISOString().slice(0, 7);
}

export function formatCancelledMonthTitleAr(ym: string): string {
  const [y, m] = ym.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, 1));
  return dt.toLocaleDateString("ar-SA", { year: "numeric", month: "long", timeZone: "UTC" });
}

export function formatPickupRangeAr(pickupDate: Date, numberOfDays: number): string {
  const start = pickupDate.toISOString().slice(0, 10);
  const end = addDaysToYmd(start, numberOfDays - 1);
  return `${start} → ${end}`;
}
