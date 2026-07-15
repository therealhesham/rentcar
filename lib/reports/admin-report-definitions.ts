import type { Prisma } from "@prisma/client";
import { bookingBranchWhere } from "@/lib/admin-access";
import type { AdminSession } from "@/lib/admin-auth";
import type { AdminPermission } from "@/lib/admin-permissions";
import { loadCancelledBookings } from "@/lib/admin-cancelled-bookings";
import {
  bookingPaymentStatusLabelAr,
  bookingStatusLabelAr,
} from "@/lib/booking-display-labels";
import { bookingPaymentMethodLabelAr } from "@/lib/booking-payment-method-label";
import { addDaysToYmd, NON_BLOCKING_BOOKING_STATUSES } from "@/lib/direct-booking";
import { prisma } from "@/lib/prisma";
import { formatReportDate, type ReportRow, type ReportTable } from "@/lib/reports/report-model";

export type ReportId =
  | "cancelled-bookings"
  | "today-bookings"
  | "financial-transactions"
  | "all-bookings-range";

export type ReportParams = { q?: string; from?: string; to?: string };

export type ReportDef = {
  id: ReportId;
  title: string;
  permission: AdminPermission;
  /** أساس اسم الملف (بالإنجليزية، بدون امتداد). */
  fileBase: string;
  load: (session: AdminSession, params: ReportParams) => Promise<ReportTable>;
};

const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

function parseFrom(ymd: string | undefined): Date | null {
  if (!ymd || !YMD_RE.test(ymd)) return null;
  const d = new Date(`${ymd}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function parseTo(ymd: string | undefined): Date | null {
  if (!ymd || !YMD_RE.test(ymd)) return null;
  const d = new Date(`${ymd}T23:59:59.999`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function endOfToday(): Date {
  const d = new Date();
  d.setHours(23, 59, 59, 999);
  return d;
}

function pickupRange(pickupDate: Date, numberOfDays: number): string {
  const start = formatReportDate(pickupDate);
  const end = addDaysToYmd(start, Math.max(0, numberOfDays - 1));
  return `${start} ← ${end}`;
}

type BookingRowForReport = Prisma.BookingRequestGetPayload<{
  include: {
    carModel: { include: { brand: true } };
    pickupBranch: { select: { name: true } };
    returnBranch: { select: { name: true } };
  };
}>;

function carLabelOf(b: BookingRowForReport): string {
  if (b.carModel) return `${b.carModel.brand.name} ${b.carModel.name}`;
  return b.carType || "—";
}

const BOOKING_INCLUDE = {
  carModel: { include: { brand: true } },
  pickupBranch: { select: { name: true } },
  returnBranch: { select: { name: true } },
} satisfies Prisma.BookingRequestInclude;

// ── تقرير: الحجوزات الملغاة ─────────────────────────────────────────────
async function loadCancelled(session: AdminSession, params: ReportParams): Promise<ReportTable> {
  const rows = await loadCancelledBookings(session, { q: params.q }, 1000);
  const data: ReportRow[] = rows.map((r) => ({
    id: r.id,
    fullName: r.fullName,
    phone: r.phone,
    car: r.carLabel,
    pickup: pickupRange(r.pickupDate, r.numberOfDays),
    cancelledAt: r.cancelledAt ? formatReportDate(r.cancelledAt) : "—",
    deduct: r.cancellationDeductedDays ?? 0,
    refund: r.cancellationRefundAmountSar ?? 0,
    payment: bookingPaymentStatusLabelAr(r.paymentStatus),
    branch: r.pickupBranchName,
  }));
  return {
    title: "تقرير الحجوزات الملغاة",
    subtitle: `${data.length} حجز${params.q ? ` · بحث: ${params.q}` : ""}`,
    generatedAt: new Date(),
    columns: [
      { key: "id", header: "#", width: 6, align: "center" },
      { key: "fullName", header: "العميل", width: 20 },
      { key: "phone", header: "الجوال", width: 14, align: "center" },
      { key: "car", header: "السيارة", width: 20 },
      { key: "pickup", header: "مدة الحجز", width: 20, align: "center" },
      { key: "cancelledAt", header: "تاريخ الإلغاء", width: 12, align: "center" },
      { key: "deduct", header: "أيام مخصومة", width: 9, align: "center", numeric: true },
      { key: "refund", header: "المسترد (ر.س)", width: 12, align: "center", numeric: true },
      { key: "payment", header: "حالة الدفع", width: 12, align: "center" },
      { key: "branch", header: "الفرع", width: 14 },
    ],
    rows: data,
  };
}

// ── تقرير: حجوزات اليوم ─────────────────────────────────────────────────
async function loadToday(session: AdminSession, _params: ReportParams): Promise<ReportTable> {
  const rows = await prisma.bookingRequest.findMany({
    where: bookingBranchWhere(session, {
      kind: "DIRECT",
      carModelId: { not: null },
      NOT: { status: { in: [...NON_BLOCKING_BOOKING_STATUSES] } },
      pickupDate: { gte: startOfToday(), lte: endOfToday() },
    }),
    include: BOOKING_INCLUDE,
    orderBy: [{ pickupDate: "asc" }, { id: "asc" }],
    take: 1000,
  });
  const data: ReportRow[] = rows.map((b) => ({
    id: b.id,
    fullName: b.fullName,
    phone: b.phone,
    car: carLabelOf(b),
    pickup: formatReportDate(b.pickupDate),
    days: b.numberOfDays,
    branch: b.pickupBranch?.name ?? "—",
    mode: b.pickupMode === "DELIVERY" ? "توصيل" : "من الفرع",
    status: bookingStatusLabelAr(b.status),
    payment: bookingPaymentStatusLabelAr(b.paymentStatus),
  }));
  return {
    title: "تقرير حجوزات اليوم",
    subtitle: `${formatReportDate(new Date())} · ${data.length} حجز`,
    generatedAt: new Date(),
    columns: [
      { key: "id", header: "#", width: 6, align: "center" },
      { key: "fullName", header: "العميل", width: 20 },
      { key: "phone", header: "الجوال", width: 14, align: "center" },
      { key: "car", header: "السيارة", width: 20 },
      { key: "pickup", header: "الاستلام", width: 12, align: "center" },
      { key: "days", header: "الأيام", width: 7, align: "center", numeric: true },
      { key: "branch", header: "الفرع", width: 14 },
      { key: "mode", header: "الاستلام", width: 10, align: "center" },
      { key: "status", header: "الحالة", width: 14, align: "center" },
      { key: "payment", header: "الدفع", width: 12, align: "center" },
    ],
    rows: data,
  };
}

// ── تقرير: الحركات المالية ──────────────────────────────────────────────
async function loadFinancial(session: AdminSession, params: ReportParams): Promise<ReportTable> {
  const from = parseFrom(params.from);
  const to = parseTo(params.to);
  const paidAt: Prisma.DateTimeNullableFilter | undefined =
    from || to ? { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } : undefined;

  const rows = await prisma.bookingRequest.findMany({
    where: bookingBranchWhere(session, {
      paymentStatus: { in: ["PAID", "REFUNDED", "PARTIAL_REFUND"] },
      ...(paidAt ? { paidAt } : {}),
    }),
    include: BOOKING_INCLUDE,
    orderBy: [{ paidAt: "desc" }, { id: "desc" }],
    take: 2000,
  });

  let paidSum = 0;
  let refundSum = 0;
  const data: ReportRow[] = rows.map((b) => {
    const paid = b.paidAmountSar ?? 0;
    const refund = b.cancellationRefundAmountSar ?? 0;
    paidSum += paid;
    refundSum += refund;
    return {
      id: b.id,
      fullName: b.fullName,
      car: carLabelOf(b),
      method: bookingPaymentMethodLabelAr(b.paymentMethod),
      paid,
      refund,
      net: Math.round((paid - refund) * 100) / 100,
      payment: bookingPaymentStatusLabelAr(b.paymentStatus),
      paidAt: b.paidAt ? formatReportDate(b.paidAt) : "—",
      ref: b.cancellationRefundExternalRef ?? "—",
    };
  });

  const rangeLabel =
    from || to
      ? `${params.from ?? "…"} ← ${params.to ?? "…"}`
      : "كل الفترات";

  return {
    title: "تقرير الحركات المالية",
    subtitle: `${rangeLabel} · ${data.length} عملية · إجمالي مدفوع ${Math.round(paidSum)} ر.س · مسترد ${Math.round(refundSum)} ر.س`,
    generatedAt: new Date(),
    columns: [
      { key: "id", header: "#", width: 6, align: "center" },
      { key: "fullName", header: "العميل", width: 20 },
      { key: "car", header: "السيارة", width: 20 },
      { key: "method", header: "طريقة الدفع", width: 12, align: "center" },
      { key: "paid", header: "المدفوع (ر.س)", width: 12, align: "center", numeric: true },
      { key: "refund", header: "المسترد (ر.س)", width: 12, align: "center", numeric: true },
      { key: "net", header: "الصافي (ر.س)", width: 12, align: "center", numeric: true },
      { key: "payment", header: "الحالة", width: 12, align: "center" },
      { key: "paidAt", header: "تاريخ الدفع", width: 12, align: "center" },
      { key: "ref", header: "المرجع", width: 16, align: "center" },
    ],
    rows: data,
  };
}

// ── تقرير: كل الحجوزات بمدى تاريخ ────────────────────────────────────────
async function loadRange(session: AdminSession, params: ReportParams): Promise<ReportTable> {
  const from = parseFrom(params.from) ?? parseFrom(addDaysToYmd(formatReportDate(new Date()), -30));
  const to = parseTo(params.to) ?? endOfToday();

  const rows = await prisma.bookingRequest.findMany({
    where: bookingBranchWhere(session, {
      kind: "DIRECT",
      pickupDate: { gte: from ?? undefined, lte: to },
    }),
    include: BOOKING_INCLUDE,
    orderBy: [{ pickupDate: "asc" }, { id: "asc" }],
    take: 3000,
  });
  const data: ReportRow[] = rows.map((b) => ({
    id: b.id,
    fullName: b.fullName,
    phone: b.phone,
    car: carLabelOf(b),
    pickup: pickupRange(b.pickupDate, b.numberOfDays),
    branch: b.pickupBranch?.name ?? "—",
    status: bookingStatusLabelAr(b.status),
    payment: bookingPaymentStatusLabelAr(b.paymentStatus),
    paid: b.paidAmountSar ?? 0,
  }));
  return {
    title: "تقرير الحجوزات (مدى تاريخ)",
    subtitle: `${from ? formatReportDate(from) : "…"} ← ${formatReportDate(to)} · ${data.length} حجز`,
    generatedAt: new Date(),
    columns: [
      { key: "id", header: "#", width: 6, align: "center" },
      { key: "fullName", header: "العميل", width: 20 },
      { key: "phone", header: "الجوال", width: 14, align: "center" },
      { key: "car", header: "السيارة", width: 20 },
      { key: "pickup", header: "مدة الحجز", width: 20, align: "center" },
      { key: "branch", header: "الفرع", width: 14 },
      { key: "status", header: "الحالة", width: 14, align: "center" },
      { key: "payment", header: "الدفع", width: 12, align: "center" },
      { key: "paid", header: "المدفوع (ر.س)", width: 12, align: "center", numeric: true },
    ],
    rows: data,
  };
}

export const REPORT_DEFS: Record<ReportId, ReportDef> = {
  "cancelled-bookings": {
    id: "cancelled-bookings",
    title: "الحجوزات الملغاة",
    permission: "BOOKINGS",
    fileBase: "cancelled-bookings",
    load: loadCancelled,
  },
  "today-bookings": {
    id: "today-bookings",
    title: "حجوزات اليوم",
    permission: "BOOKINGS",
    fileBase: "today-bookings",
    load: loadToday,
  },
  "financial-transactions": {
    id: "financial-transactions",
    title: "الحركات المالية",
    permission: "FINANCIALS",
    fileBase: "financial-transactions",
    load: loadFinancial,
  },
  "all-bookings-range": {
    id: "all-bookings-range",
    title: "كل الحجوزات (مدى تاريخ)",
    permission: "BOOKINGS",
    fileBase: "bookings-range",
    load: loadRange,
  },
};

export function isReportId(v: string): v is ReportId {
  return v in REPORT_DEFS;
}
