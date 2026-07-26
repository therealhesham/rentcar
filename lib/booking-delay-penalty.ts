import { computeBookingReturnAt } from "@/lib/booking-return-schedule";

/** ساعات التأخير المسموحة دون رسوم (حجز يومي). */
export const DELAY_PENALTY_FREE_HOURS = 2;

/** فوق هذه المدة يُحتسب يوم إيجار إضافي كساعات تأخير. */
export const DELAY_PENALTY_FULL_DAY_HOURS = 4;

export type DelayPenaltyKind = "none" | "hourly" | "full_day";

export type DelayPenaltySnap = {
  kind: DelayPenaltyKind;
  /** ساعات التأخير عن موعد الإرجاع المتوقّع. */
  lateHours: number;
  /** ساعات التأخير المستخدمة في المعادلة عند kind === hourly */
  billableHours: number;
  /** أيام التأخير المحتسبة عند kind === full_day (تراكمي). */
  billableDays: number;
  feeExclVatSar: number;
  labelAr: string;
  scheduledReturnAt: string;
  actualDropoffAt: string;
};

export type DelayPenaltyComputeInput = {
  rentalTab: string | null | undefined;
  pricePerDayExclTax: number;
  pickupDate: Date;
  numberOfDays: number;
  actualDropoffDate: Date | null | undefined;
};

function safePrice(n: number): number {
  const x = Number(n);
  return Number.isFinite(x) && x >= 0 ? x : 0;
}

/** فرق الساعات بين التسليم الفعلي وموعد الإرجاع المتوقّع (نفس منطق `computeBookingReturnAt`). */
export function computeLateReturnHours(
  pickupDate: Date,
  numberOfDays: number,
  actualDropoffDate: Date,
): number {
  const scheduled = computeBookingReturnAt(pickupDate, numberOfDays);
  const lateMs = actualDropoffDate.getTime() - scheduled.getTime();
  if (!Number.isFinite(lateMs) || lateMs <= 0) return 0;
  return lateMs / 3_600_000;
}

/**
 * ساعات تأخير الحجز اليومي:
 * - حتى ساعتين: مجاني
 * - أكثر من ساعتين وحتى 4 ساعات: (ساعات التأخير × سعر اليوم ÷ 24) × 2
 * - أكثر من 4 ساعات: غرامة تراكمية بالأيام — كل يوم تأخير (24 ساعة، والجزء منها
 *   يُجبَر لأعلى ليوم كامل) = سعر يوم إيجار. مثال: 25 ساعة = يومان، 93 ساعة = 4 أيام.
 */
export function computeDelayPenaltyExclTax(
  pricePerDayExclTax: number,
  lateHours: number,
): { feeExclVatSar: number; kind: DelayPenaltyKind; billableHours: number; billableDays: number } {
  const price = safePrice(pricePerDayExclTax);
  if (lateHours <= DELAY_PENALTY_FREE_HOURS) {
    return { feeExclVatSar: 0, kind: "none", billableHours: 0, billableDays: 0 };
  }
  if (lateHours > DELAY_PENALTY_FULL_DAY_HOURS) {
    // تراكمي: كل يوم تأخير (أو جزء منه) = سعر يوم كامل.
    const billableDays = Math.max(1, Math.ceil(lateHours / 24));
    return {
      feeExclVatSar: Math.round(price * billableDays),
      kind: "full_day",
      billableHours: 0,
      billableDays,
    };
  }
  // لا تُحتسب الكسور: تُجبَر ساعات التأخير لأعلى لأقرب ساعة كاملة (2.3 → 3، 1.1 → 2)،
  // ويُحسب المبلغ على أساس الساعات المجبورة.
  const billableHours = Math.ceil(lateHours);
  const raw = ((billableHours * price) / 24) * 2;
  return {
    feeExclVatSar: Math.round(raw * 100) / 100,
    kind: "hourly",
    billableHours,
    billableDays: 0,
  };
}

function formatHoursAr(h: number): string {
  if (h % 1 === 0) return String(Math.round(h));
  return h.toLocaleString("ar-SA", { maximumFractionDigits: 1 });
}

function buildDelayLabelAr(kind: DelayPenaltyKind): string {
  return kind === "full_day" ? `أيام تأخير` : `ساعات تأخير`;
}

export function isDailyRentalTab(rentalTab: string | null | undefined): boolean {
  return String(rentalTab ?? "")
    .trim()
    .toLowerCase() === "daily";
}

export function computeDelayPenaltySnap(
  input: DelayPenaltyComputeInput,
): DelayPenaltySnap | null {
  if (!isDailyRentalTab(input.rentalTab)) return null;
  const dropoff = input.actualDropoffDate;
  if (!dropoff || Number.isNaN(dropoff.getTime())) return null;

  const pickup = input.pickupDate;
  if (Number.isNaN(pickup.getTime())) return null;
  if (dropoff.getTime() < pickup.getTime()) return null;

  const lateHours = computeLateReturnHours(pickup, input.numberOfDays, dropoff);
  const { feeExclVatSar, kind, billableHours, billableDays } = computeDelayPenaltyExclTax(
    input.pricePerDayExclTax,
    lateHours,
  );
  if (kind === "none" || feeExclVatSar <= 0) return null;

  const scheduledReturnAt = computeBookingReturnAt(pickup, input.numberOfDays).toISOString();

  return {
    kind,
    lateHours,
    billableHours,
    billableDays,
    feeExclVatSar,
    labelAr: buildDelayLabelAr(kind),
    scheduledReturnAt,
    actualDropoffAt: dropoff.toISOString(),
  };
}
