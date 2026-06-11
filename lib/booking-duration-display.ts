import { computeBookingDays } from "@/lib/booking-days";
import { computeBookingReturnAt } from "@/lib/booking-return-schedule";

/** دقائق — إن كان فرق الوقت أقل يُعتبر تطابقاً تاماً (عرض «X يوم» فقط). */
const EXACT_TIME_TOLERANCE_MS = 60_000;

export type DailyBookingDurationParts = {
  /** أيام الإيجار للتسعير (تقويمي). */
  days: number;
  /** ساعات إضافية بعد نهاية المدة (نفس ساعة الاستلام + الأيام). */
  extraHours: number;
};

function formatCountAr(
  n: number,
  forms: { one: string; two: string; few: string; many: string },
): string {
  const x = Math.round(n);
  if (x === 1) return forms.one;
  if (x === 2) return forms.two;
  if (x >= 3 && x <= 10) return forms.few.replace("{n}", String(x));
  return forms.many.replace("{n}", String(x));
}

function formatDaysUnitAr(days: number): string {
  return formatCountAr(days, {
    one: "يوم واحد",
    two: "يومين",
    few: "{n} أيام",
    many: "{n} يوم",
  });
}

function formatHoursUnitAr(hours: number): string {
  const h = Math.ceil(hours);
  if (h === 1) return "ساعة واحدة";
  if (h === 2) return "ساعتين";
  if (h >= 3 && h <= 10) {
    return `${h} ساعات`;
  }
  return `${h} ساعة`;
}

/** ساعات التسليم بعد موعد الإرجاع المتوقّع (نفس منطق غرامة التأخير). */
export function computeDailyBookingExtraHours(
  pickup: Date,
  dropoff: Date,
  days: number,
): number {
  const scheduled = computeBookingReturnAt(pickup, days);
  const diffMs = dropoff.getTime() - scheduled.getTime();
  if (diffMs <= EXACT_TIME_TOLERANCE_MS) return 0;
  if (diffMs < 0) return 0;
  return Math.ceil(diffMs / 3_600_000);
}

export function computeDailyBookingDurationParts(
  pickup: Date,
  dropoff: Date,
): DailyBookingDurationParts | null {
  if (Number.isNaN(pickup.getTime()) || Number.isNaN(dropoff.getTime())) return null;
  if (dropoff.getTime() < pickup.getTime()) return null;
  const days = computeBookingDays(pickup, dropoff);
  const extraHours = computeDailyBookingExtraHours(pickup, dropoff, days);
  return { days, extraHours };
}

/** نص عربي: «يومين» أو «يومين + 4 ساعات». */
export function formatDailyBookingDurationAr(parts: DailyBookingDurationParts): string {
  const daysLabel = formatDaysUnitAr(parts.days);
  if (parts.extraHours <= EXACT_TIME_TOLERANCE_MS / 3_600_000) {
    return daysLabel;
  }
  return `${daysLabel} + ${formatHoursUnitAr(parts.extraHours)}`;
}

export function formatDailyBookingDurationFromIso(
  pickupIso: string,
  dropoffIso: string,
): string | null {
  if (!pickupIso.trim() || !dropoffIso.trim()) return null;
  const pickup = new Date(pickupIso);
  const dropoff = new Date(dropoffIso);
  const parts = computeDailyBookingDurationParts(pickup, dropoff);
  if (!parts) return null;
  return formatDailyBookingDurationAr(parts);
}
