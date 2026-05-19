import { addDaysToYmd, dateOnlyYmd } from "@/lib/booking-calendar-ymd";

const BRANCH_TZ = "Asia/Riyadh";

function safeBookingDays(days: number): number {
  const n = Math.round(Number(days));
  return Math.max(1, Math.min(60, Number.isFinite(n) ? n : 1));
}

/** أول يوم تقويمي بعد انتهاء مدة الإيجار (يوم الإرجاع). */
export function bookingReturnYmd(pickupDate: Date, numberOfDays: number): string {
  return addDaysToYmd(dateOnlyYmd(pickupDate), safeBookingDays(numberOfDays));
}

/** تاريخ ووقت الإرجاع المتوقّع (نفس ساعة الاستلام + عدد أيام الحجز). */
export function computeBookingReturnAt(pickupDate: Date, numberOfDays: number): Date {
  const d = new Date(pickupDate.getTime());
  d.setUTCDate(d.getUTCDate() + safeBookingDays(numberOfDays));
  return d;
}

export function formatReturnTimeAr(returnAt: Date): string {
  return returnAt.toLocaleTimeString("ar-SA", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: true,
    timeZone: BRANCH_TZ,
  });
}

export function formatReturnDateAr(ymd: string): string {
  const [y, m, day] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, day));
  return dt.toLocaleDateString("ar-SA", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}
