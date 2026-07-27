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
  /** حُصِّل مبلغ هذا البند بالفعل (مشتق من الرصيد القائم — انظر الدالة أدناه). */
  settled: boolean;
};

export type BookingExtraChargesSummary = {
  charges: BookingExtraChargeRow[];
  /** مجموع البنود السارية (شامل الضريبة) — إجمالي ما سُجّل، محصَّلاً كان أم لا. */
  activeTotalInclTaxSar: number;
  activeCount: number;
  /** الجزء الذي لم يُحصَّل بعد من البنود السارية. */
  unsettledTotalInclTaxSar: number;
  unsettledCount: number;
};

/**
 * كل بنود الرسوم الإضافية على حجز، مرتّبة من الأحدث.
 *
 * لا يحمل البند علم تحصيل خاص به لأن التحصيل يتم على وعاء واحد
 * (`balanceDueAtBranchSar`) تُصبّ فيه الرسوم وفروق التمديد معاً. لذا نشتق حالة
 * كل بند من الرصيد المتبقي: الأقدم يُسدَّد أولاً، وما يغطّيه الرصيد الباقي
 * (محدوداً بمجموع البنود) يبقى غير محصَّل. البند المغطى جزئياً يُعدّ غير محصَّل
 * حتى لا نَعِد الموظف بتحصيل لم يكتمل.
 */
export async function getBookingExtraCharges(
  bookingId: number,
  outstandingBranchBalanceSar: number,
): Promise<BookingExtraChargesSummary> {
  const rows = await prisma.bookingExtraCharge.findMany({
    where: { bookingId },
    orderBy: { createdAt: "desc" },
  });

  const activeTotal = round2(
    rows.filter((r) => r.status === "ACTIVE").reduce((s, r) => s + r.amountInclTaxSar, 0),
  );
  // الرصيد قد يضم فروق تمديد أيضاً؛ لا ننسب للرسوم أكثر من مجموعها.
  let unsettledPool = Math.min(Math.max(0, outstandingBranchBalanceSar), activeTotal);

  // rows مرتّبة تنازلياً، فالمرور عليها كما هي يبدأ من الأحدث = آخر ما يُسدَّد.
  const charges: BookingExtraChargeRow[] = rows.map((r) => {
    if (r.status !== "ACTIVE") return { ...r, settled: false };
    const covered = unsettledPool > 0;
    unsettledPool = Math.max(0, round2(unsettledPool - r.amountInclTaxSar));
    return { ...r, settled: !covered };
  });

  const unsettled = charges.filter((c) => c.status === "ACTIVE" && !c.settled);

  return {
    charges,
    activeTotalInclTaxSar: activeTotal,
    activeCount: rows.filter((r) => r.status === "ACTIVE").length,
    unsettledTotalInclTaxSar: round2(
      unsettled.reduce((s, r) => s + r.amountInclTaxSar, 0),
    ),
    unsettledCount: unsettled.length,
  };
}
