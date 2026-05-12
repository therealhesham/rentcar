import { computeBookingDays } from "@/lib/booking-days";

export type RentalTab = "daily" | "weekly" | "monthly" | "monthly_packages";
export type ModeTab = "pickup" | "delivery";

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** قيمة حقول `datetime-local` بالتوقيت المحلي */
export function toDatetimeLocalValue(d: Date): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function addLocalDays(base: Date, days: number): Date {
  const d = new Date(base.getTime());
  d.setDate(d.getDate() + days);
  return d;
}

/** شهر تقويمي كامل؛ إن لم يوجد نفس يوم الشهر يُضبط على آخر يوم الشهر السابق */
export function addLocalCalendarMonths(base: Date, months: number): Date {
  const d = new Date(base.getTime());
  const day = d.getDate();
  d.setMonth(d.getMonth() + months);
  if (d.getDate() !== day) {
    d.setDate(0);
  }
  return d;
}

export function computeAutoDropoff(pickup: Date, rental: RentalTab): Date | null {
  if (rental === "weekly") return addLocalDays(pickup, 7);
  if (rental === "monthly" || rental === "monthly_packages") {
    return addLocalCalendarMonths(pickup, 1);
  }
  return null;
}

export function validateRentalMinDays(rental: RentalTab, days: number): string | null {
  if (rental === "weekly" && days < 7) {
    return "نوع الأسبوعي يتطلّب مدة لا تقل عن 7 أيام بين الاستلام والتسليم.";
  }
  if (rental === "monthly_packages" && days < 28) {
    return "الباقات الشهرية تتطلّب مدة لا تقل عن 28 يوماً بين الاستلام والتسليم.";
  }
  if (rental === "monthly" && days < 28) {
    return "نوع الشهري يتطلّب مدة لا تقل عن 28 يوماً بين الاستلام والتسليم.";
  }
  return null;
}

export function computeDaysPreview(pickupDt: string, dropoffDt: string): number | null {
  if (!pickupDt || !dropoffDt) return null;
  const p = new Date(pickupDt);
  const d = new Date(dropoffDt);
  if (Number.isNaN(p.getTime()) || Number.isNaN(d.getTime())) return null;
  return computeBookingDays(p, d);
}

/** مقطع مساعدة تحت عنوان «تاريخ التسليم» في نماذج البحث */
export function rentalDropoffHint(rental: RentalTab): string | undefined {
  if (rental === "weekly") return "يُحدَّد تلقائياً بعد أسبوع من وقت الاستلام.";
  if (rental === "monthly") return "يُحدَّد تلقائياً بعد شهر تقويمي من الاستلام.";
  if (rental === "monthly_packages") {
    return "فترة شهر تقويمي أساساً للبحث؛ التسعير وفق الباقات الشهرية المعروضة.";
  }
  return undefined;
}
