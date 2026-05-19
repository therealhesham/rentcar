import type { Prisma } from "@prisma/client";
import type { InterCityShippingSnap } from "@/lib/inter-city-shipping";
import { addDaysToYmd } from "@/lib/booking-calendar-ymd";
import { daysInCalendarMonth } from "@/lib/calendar-month-grid";
import {
  bookingReturnYmd,
  computeBookingReturnAt,
} from "@/lib/booking-return-schedule";
import { NON_BLOCKING_BOOKING_STATUSES } from "@/lib/direct-booking";
import { prisma } from "@/lib/prisma";

export type BranchReturnRow = {
  id: number;
  fullName: string;
  phone: string;
  contactEmail: string | null;
  status: string;
  paymentStatus: string;
  pickupMode: string | null;
  deliveryAddress: string | null;
  branchSlug: string;
  returnAt: Date;
  returnYmd: string;
  numberOfDays: number;
  pickupDate: Date;
  carLabel: string;
  pickupSummary: string;
};

function parseInterCityFromAddons(addonsJson: string | null): InterCityShippingSnap | null {
  if (!addonsJson?.trim()) return null;
  try {
    const o = JSON.parse(addonsJson) as { interCityShipping?: InterCityShippingSnap };
    const s = o.interCityShipping;
    if (s && typeof s.labelAr === "string" && s.labelAr.trim()) return s;
  } catch {
    /* ignore */
  }
  return null;
}

function buildPickupSummary(
  row: {
    pickupMode: string | null;
    deliveryAddress: string | null;
    branch: string;
  },
  branchNames: Map<string, string>,
  interCity: InterCityShippingSnap | null,
): string {
  if (row.pickupMode === "DELIVERY") {
    const addr = row.deliveryAddress?.trim();
    return addr ? `توصيل — ${addr}` : "توصيل للعميل";
  }
  if (interCity?.labelAr) {
    return `استلام: ${interCity.labelAr}`;
  }
  const returnName = branchNames.get(row.branch) ?? row.branch;
  return `استلام من فرع (${returnName})`;
}

const MAX_RENTAL_DAYS = 60;

function bookingWhereForReturnWindow(
  returnStartYmd: string,
  returnEndYmd: string,
  returnBranchSlug?: string | null,
): Prisma.BookingRequestWhereInput {
  const earliestPickupYmd = addDaysToYmd(returnStartYmd, -MAX_RENTAL_DAYS);
  return {
    kind: "DIRECT",
    carModelId: { not: null },
    NOT: { status: { in: [...NON_BLOCKING_BOOKING_STATUSES] } },
    ...(returnBranchSlug ? { branch: returnBranchSlug } : {}),
    pickupDate: { gte: new Date(`${earliestPickupYmd}T00:00:00.000Z`) },
  };
}

type BookingWithCar = {
  pickupDate: Date;
  numberOfDays: number;
  addonsJson: string | null;
  id: number;
  fullName: string;
  phone: string;
  contactEmail: string | null;
  status: string;
  paymentStatus: string;
  pickupMode: string | null;
  deliveryAddress: string | null;
  branch: string;
  carModel: { brand: { name: string }; name: string } | null;
};

async function mapRowsToBranchReturns(
  rows: BookingWithCar[],
  filter: (returnYmd: string) => boolean,
): Promise<BranchReturnRow[]> {
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    select: { slug: true, name: true },
  });
  const branchNames = new Map(branches.map((b) => [b.slug, b.name]));

  const out: BranchReturnRow[] = [];
  for (const row of rows) {
    const returnYmd = bookingReturnYmd(row.pickupDate, row.numberOfDays);
    if (!filter(returnYmd)) continue;

    const returnAt = computeBookingReturnAt(row.pickupDate, row.numberOfDays);
    const interCity = parseInterCityFromAddons(row.addonsJson);
    const carLabel = row.carModel
      ? `${row.carModel.brand.name} ${row.carModel.name}`
      : "—";

    out.push({
      id: row.id,
      fullName: row.fullName,
      phone: row.phone,
      contactEmail: row.contactEmail,
      status: row.status,
      paymentStatus: row.paymentStatus,
      pickupMode: row.pickupMode,
      deliveryAddress: row.deliveryAddress,
      branchSlug: row.branch,
      returnAt,
      returnYmd,
      numberOfDays: row.numberOfDays,
      pickupDate: row.pickupDate,
      carLabel,
      pickupSummary: buildPickupSummary(row, branchNames, interCity),
    });
  }

  out.sort((a, b) => a.returnAt.getTime() - b.returnAt.getTime());
  return out;
}

/** عدد المرتجعات لكل يوم في شهر (مفتاح YYYY-MM-DD). */
export async function loadBranchReturnCountsForMonth(input: {
  yearMonth: string;
  returnBranchSlug?: string | null;
}): Promise<Record<string, number>> {
  const dim = daysInCalendarMonth(input.yearMonth);
  const returnStartYmd = `${input.yearMonth}-01`;
  const returnEndYmd = `${input.yearMonth}-${String(dim).padStart(2, "0")}`;

  const rows = await prisma.bookingRequest.findMany({
    where: bookingWhereForReturnWindow(
      returnStartYmd,
      returnEndYmd,
      input.returnBranchSlug,
    ),
    select: { pickupDate: true, numberOfDays: true },
  });

  const counts: Record<string, number> = {};
  for (const row of rows) {
    const returnYmd = bookingReturnYmd(row.pickupDate, row.numberOfDays);
    if (returnYmd < returnStartYmd || returnYmd > returnEndYmd) continue;
    counts[returnYmd] = (counts[returnYmd] ?? 0) + 1;
  }
  return counts;
}

export async function loadBranchReturnsForDay(input: {
  viewYmd: string;
  returnBranchSlug?: string | null;
}): Promise<BranchReturnRow[]> {
  const rows = await prisma.bookingRequest.findMany({
    where: bookingWhereForReturnWindow(
      input.viewYmd,
      input.viewYmd,
      input.returnBranchSlug,
    ),
    include: { carModel: { include: { brand: true } } },
    orderBy: [{ pickupDate: "asc" }, { id: "asc" }],
  });
  return mapRowsToBranchReturns(rows, (returnYmd) => returnYmd === input.viewYmd);
}

export async function loadBranchReturnsForMonth(input: {
  yearMonth: string;
  returnBranchSlug?: string | null;
}): Promise<BranchReturnRow[]> {
  const dim = daysInCalendarMonth(input.yearMonth);
  const returnStartYmd = `${input.yearMonth}-01`;
  const returnEndYmd = `${input.yearMonth}-${String(dim).padStart(2, "0")}`;

  const rows = await prisma.bookingRequest.findMany({
    where: bookingWhereForReturnWindow(
      returnStartYmd,
      returnEndYmd,
      input.returnBranchSlug,
    ),
    include: { carModel: { include: { brand: true } } },
    orderBy: [{ pickupDate: "asc" }, { id: "asc" }],
  });
  return mapRowsToBranchReturns(
    rows,
    (returnYmd) => returnYmd >= returnStartYmd && returnYmd <= returnEndYmd,
  );
}
