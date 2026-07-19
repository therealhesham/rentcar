import type { Prisma } from "@prisma/client";
import { bookingBranchWhere } from "@/lib/admin-access";
import type { AdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

/**
 * حجز فائت = حجز مباشر لم تُستلم سيارته ومرّ على موعد الاستلام مهلة سماح (12 ساعة).
 * يخرج من قائمة الحجوزات النشطة ويظهر في صفحة الحجوزات الفائتة.
 */
export const MISSED_PICKUP_GRACE_HOURS = 12;

/** الحالات التي لا تُعتبر «بانتظار الاستلام» (نهائية أو تم استلامها). */
const NOT_AWAITING_PICKUP_STATUSES = [
  "CANCELLED",
  "REJECTED",
  "RETURNED",
  "COMPLETED",
  "PICKED_UP",
];

/** اللحظة التي يصبح قبلها الحجز غير المستلَم فائتاً (الآن − مهلة السماح). */
export function missedPickupCutoff(now: Date = new Date()): Date {
  return new Date(now.getTime() - MISSED_PICKUP_GRACE_HOURS * 60 * 60 * 1000);
}

/**
 * شرط «الحجز فائت» (بدون قيد النوع/الفرع) — يُستخدم في صفحة الفائتة،
 * وتحت NOT لاستبعادها من قائمة الحجوزات النشطة.
 */
export function missedPickupCondition(
  now: Date = new Date(),
): Prisma.BookingRequestWhereInput {
  return {
    status: { notIn: NOT_AWAITING_PICKUP_STATUSES },
    pickupDate: { lt: missedPickupCutoff(now) },
  };
}

export type MissedBookingsFilter = { q?: string };

export type MissedBookingRow = {
  id: number;
  fullName: string;
  phone: string;
  pickupDate: Date;
  numberOfDays: number;
  status: string;
  paymentStatus: string;
  paymentMethod: string | null;
  carLabel: string;
  pickupBranchName: string;
  pickupMode: string | null;
};

function buildWhere(
  session: AdminSession,
  filter: MissedBookingsFilter,
  now: Date,
): Prisma.BookingRequestWhereInput {
  const extra: Prisma.BookingRequestWhereInput = {
    kind: "DIRECT",
    carModelId: { not: null },
    ...missedPickupCondition(now),
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

export async function loadMissedBookings(
  session: AdminSession,
  filter: MissedBookingsFilter = {},
  take = 200,
  now: Date = new Date(),
): Promise<MissedBookingRow[]> {
  const rows = await prisma.bookingRequest.findMany({
    where: buildWhere(session, filter, now),
    orderBy: [{ pickupDate: "asc" }, { id: "asc" }],
    take,
    include: {
      carModel: { include: { brand: true } },
      pickupBranch: { select: { name: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    fullName: r.fullName,
    phone: r.phone,
    pickupDate: r.pickupDate,
    numberOfDays: r.numberOfDays,
    status: r.status,
    paymentStatus: r.paymentStatus,
    paymentMethod: r.paymentMethod,
    carLabel: r.carModel ? `${r.carModel.brand.name} ${r.carModel.name}` : r.carType || "—",
    pickupBranchName: r.pickupBranch?.name ?? "—",
    pickupMode: r.pickupMode,
  }));
}

export async function countMissedBookings(
  session: AdminSession,
  filter: MissedBookingsFilter = {},
  now: Date = new Date(),
): Promise<number> {
  return prisma.bookingRequest.count({ where: buildWhere(session, filter, now) });
}

/** عدد الأيام المنقضية منذ موعد الاستلام (للعرض). */
export function daysOverdue(pickupDate: Date, now: Date = new Date()): number {
  const ms = now.getTime() - pickupDate.getTime();
  return Math.max(0, Math.floor(ms / (24 * 60 * 60 * 1000)));
}
