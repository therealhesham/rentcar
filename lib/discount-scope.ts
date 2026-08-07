/**
 * نطاق الخصم بحسب نوع التأجير — مشترك بين `RentalDiscount` و`CouponCode`
 * عشان القاعدتين ما يفترقوش مع الوقت.
 */
import type { DiscountAppliesTo } from "@prisma/client";
import type { RentalPeriodKind } from "@/lib/min-price-floor";

export const DISCOUNT_APPLIES_TO_VALUES = [
  "DAILY_ONLY",
  "MONTHLY_ONLY",
  "DAILY_AND_MONTHLY",
] as const satisfies ReadonlyArray<DiscountAppliesTo>;

export function isDiscountAppliesTo(v: string): v is DiscountAppliesTo {
  return (DISCOUNT_APPLIES_TO_VALUES as ReadonlyArray<string>).includes(v);
}

export const DISCOUNT_APPLIES_TO_LABELS_AR: Record<DiscountAppliesTo, string> = {
  DAILY_ONLY: "التأجير اليومي فقط",
  MONTHLY_ONLY: "التأجير الشهري فقط",
  DAILY_AND_MONTHLY: "اليومي والشهري معاً",
};

/** هل يسري الخصم على نوع التأجير المطلوب؟ الافتراضي عند غياب النوع = يومي. */
export function discountAppliesToPeriod(
  appliesTo: DiscountAppliesTo,
  periodKind: RentalPeriodKind | null | undefined,
): boolean {
  if (appliesTo === "DAILY_AND_MONTHLY") return true;
  return (periodKind ?? "DAILY") === "MONTHLY"
    ? appliesTo === "MONTHLY_ONLY"
    : appliesTo === "DAILY_ONLY";
}
