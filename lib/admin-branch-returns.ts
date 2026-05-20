import type { Prisma } from "@prisma/client";
import type { InterCityShippingSnap } from "@/lib/inter-city-shipping";
import { addDaysToYmd } from "@/lib/booking-calendar-ymd";
import { daysInCalendarMonth } from "@/lib/calendar-month-grid";
import {
  bookingBranchRelationsSelect,
  isInterBranchPickupReturn,
  resolvePickupBranchSlug,
  resolveReturnBranchSlug,
} from "@/lib/booking-branches";
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
  returnBranchName: string;
  pickupBranchName: string | null;
  isInterBranchPickup: boolean;
  interBranchReturnConfirmedAt: Date | null;
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
    pickupBranch?: { name: string } | null;
    returnBranch?: { name: string } | null;
  },
  interCity: InterCityShippingSnap | null,
  pickupName: string | null,
): string {
  if (row.pickupMode === "DELIVERY") {
    const addr = row.deliveryAddress?.trim();
    return addr ? `توصيل — ${addr}` : "توصيل للعميل";
  }
  if (interCity?.labelAr) {
    return interCity.labelAr;
  }
  if (pickupName) {
    return `فرع ${pickupName}`;
  }
  const returnName = row.returnBranch?.name;
  return returnName ? `فرع ${returnName}` : "—";
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
    ...(returnBranchSlug
      ? { returnBranch: { slug: returnBranchSlug.trim().toLowerCase() } }
      : {}),
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
  branchId: number | null;
  returnBranchId: number | null;
  interBranchReturnConfirmedAt: Date | null;
  pickupBranch: { slug: string; name: string } | null;
  returnBranch: { slug: string; name: string } | null;
  carModel: { brand: { name: string }; name: string } | null;
};

async function mapRowsToBranchReturns(
  rows: BookingWithCar[],
  filter: (returnYmd: string) => boolean,
): Promise<BranchReturnRow[]> {
  const out: BranchReturnRow[] = [];
  for (const row of rows) {
    const returnYmd = bookingReturnYmd(row.pickupDate, row.numberOfDays);
    if (!filter(returnYmd)) continue;

    const returnAt = computeBookingReturnAt(row.pickupDate, row.numberOfDays);
    const interCity = parseInterCityFromAddons(row.addonsJson);
    const pickupSlug = resolvePickupBranchSlug(row);
    const pickupName = pickupSlug
      ? (row.pickupBranch?.name ?? pickupSlug)
      : null;
    const isInterBranchPickup = isInterBranchPickupReturn(row);
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
      returnBranchName: row.returnBranch?.name ?? resolveReturnBranchSlug(row) ?? "—",
      pickupBranchName: pickupName,
      isInterBranchPickup,
      interBranchReturnConfirmedAt: row.interBranchReturnConfirmedAt,
      returnAt,
      returnYmd,
      numberOfDays: row.numberOfDays,
      pickupDate: row.pickupDate,
      carLabel,
      pickupSummary: buildPickupSummary(row, interCity, pickupName),
    });
  }

  out.sort((a, b) => a.returnAt.getTime() - b.returnAt.getTime());
  return out;
}

const returnSelect = {
  pickupDate: true,
  numberOfDays: true,
  addonsJson: true,
  id: true,
  fullName: true,
  phone: true,
  contactEmail: true,
  status: true,
  paymentStatus: true,
  pickupMode: true,
  deliveryAddress: true,
  branchId: true,
  returnBranchId: true,
  interBranchReturnConfirmedAt: true,
  ...bookingBranchRelationsSelect,
  carModel: { include: { brand: true } },
} as const;

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
    select: returnSelect,
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
    select: returnSelect,
    orderBy: [{ pickupDate: "asc" }, { id: "asc" }],
  });
  return mapRowsToBranchReturns(
    rows,
    (returnYmd) => returnYmd >= returnStartYmd && returnYmd <= returnEndYmd,
  );
}
