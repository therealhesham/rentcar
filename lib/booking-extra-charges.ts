import "server-only";
import { prisma } from "@/lib/prisma";

/** أنواع بنود الرسوم الإضافية التي يسجّلها الموظف على الحجز. */
export const EXTRA_CHARGE_KINDS = [
  "DAMAGE",
  "FUEL",
  "TRAFFIC_FINE",
  "CLEANING",
  "LOST_ITEM",
  "OTHER",
] as const;

export type ExtraChargeKind = (typeof EXTRA_CHARGE_KINDS)[number];

export const EXTRA_CHARGE_KIND_LABELS_AR: Record<string, string> = {
  DAMAGE: "تلفيات",
  FUEL: "وقود ناقص",
  TRAFFIC_FINE: "مخالفة مرورية",
  CLEANING: "تنظيف",
  LOST_ITEM: "فقدان عهدة",
  OTHER: "أخرى",
};

export function extraChargeKindLabelAr(kind: string): string {
  return EXTRA_CHARGE_KIND_LABELS_AR[kind.trim().toUpperCase()] ?? kind;
}

export function isExtraChargeKind(value: string): value is ExtraChargeKind {
  return (EXTRA_CHARGE_KINDS as readonly string[]).includes(value);
}

/** نسبة الضريبة الافتراضية عندما يُعلَّم البند كخاضع للضريبة. */
export const DEFAULT_EXTRA_CHARGE_VAT_PERCENT = 15;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * حساب إجمالي البند شامل الضريبة. البند غير الخاضع للضريبة (تعويض تلفيات مثلاً)
 * يُحصَّل بمبلغه كما هو دون إضافة.
 */
export function computeExtraChargeTotal(
  amountExclTaxSar: number,
  isTaxable: boolean,
  vatRatePercent: number,
): { vatRatePercent: number; amountInclTaxSar: number } {
  const rate = isTaxable ? vatRatePercent : 0;
  return {
    vatRatePercent: rate,
    amountInclTaxSar: round2(amountExclTaxSar * (1 + rate / 100)),
  };
}

export type BookingExtraChargeRow = {
  id: number;
  kind: string;
  description: string;
  amountExclTaxSar: number;
  isTaxable: boolean;
  vatRatePercent: number;
  amountInclTaxSar: number;
  status: string;
  voidedAt: Date | null;
  voidedBy: string | null;
  voidReason: string | null;
  createdBy: string | null;
  createdAt: Date;
};

export type BookingExtraChargesSummary = {
  charges: BookingExtraChargeRow[];
  /** مجموع البنود السارية (شامل الضريبة) — الجزء المضاف لرصيد التحصيل. */
  activeTotalInclTaxSar: number;
  activeCount: number;
};

/** كل بنود الرسوم الإضافية على حجز، مرتّبة من الأحدث، مع مجموع البنود السارية. */
export async function getBookingExtraCharges(
  bookingId: number,
): Promise<BookingExtraChargesSummary> {
  const rows = await prisma.bookingExtraCharge.findMany({
    where: { bookingId },
    orderBy: { createdAt: "desc" },
  });

  const active = rows.filter((r) => r.status === "ACTIVE");

  return {
    charges: rows,
    activeTotalInclTaxSar: round2(active.reduce((s, r) => s + r.amountInclTaxSar, 0)),
    activeCount: active.length,
  };
}
