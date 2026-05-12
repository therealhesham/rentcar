import { addLocalCalendarMonths, toDatetimeLocalValue } from "@/lib/booking-search-shared";

/** أشهر باقة الاشتراك المعروضة في الـ widget */
export const SUBSCRIPTION_PACK_MONTHS = [1, 3, 6] as const;
export type SubscriptionPackMonths = (typeof SUBSCRIPTION_PACK_MONTHS)[number];

/**
 * يحوّل يوم بدء الباقة (محلي yyyy-mm-dd) + عدد أشهر تقويمية إلى قيم `datetime-local`
 * متوافقة مع بحث الأسطول (مدة بالأيام بين الاستلام والتسليم).
 */
export function fleetDatetimesFromSubscriptionPack(
  startYmd: string,
  months: number,
): { pickupDt: string; dropoffDt: string } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(startYmd).trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  if (!Number.isInteger(y) || !Number.isInteger(mo) || !Number.isInteger(d)) return null;
  const start = new Date(y, mo - 1, d, 9, 0, 0, 0);
  if (
    Number.isNaN(start.getTime()) ||
    start.getFullYear() !== y ||
    start.getMonth() !== mo - 1 ||
    start.getDate() !== d
  ) {
    return null;
  }
  const end = addLocalCalendarMonths(start, months);
  return {
    pickupDt: toDatetimeLocalValue(start),
    dropoffDt: toDatetimeLocalValue(end),
  };
}
