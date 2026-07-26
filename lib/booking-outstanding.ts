import { computeCheckoutTotals } from "@/lib/booking-checkout-pricing";
import {
  parseBookingPricingSnapshot,
  resolveBookingRentalPricePerDayExclTax,
} from "@/lib/booking-pricing-snapshot";

/**
 * حساب «رصيد التحصيل» لحجز — نفس منطق صفحة العمليات المالية (مصدر الحقيقة).
 * يُستخدم في صفحة المالية وفي لوحة دورة الحياة (تنبيه الموظف عند استلام السيارة).
 */

export type BookingOutstandingInput = {
  status: string;
  paymentStatus: string;
  paidAmountSar: number | null;
  numberOfDays: number;
  addonsJson: string | null;
  carModel: { price: number; vatRatePercent: number } | null;
  /** رصيد تمديد/تعديل مستحق عند الفرع (منفصل عن حساب الإجمالي). */
  balanceDueAtBranchSar?: number | null;
};

export type BookingOutstanding = {
  /** الإجمالي المحسوب من لقطة التسعير (شامل الضريبة والرسوم والغرامة إن وُجدت). */
  totalInclTax: number;
  /** المتبقي للتحصيل = الإجمالي − المدفوع (صفر في الحالات النهائية/المستردة). */
  outstandingDueSar: number;
  /** رصيد التمديد المستحق عند الفرع (صفر في الحالات النهائية). */
  balanceDueAtBranchSar: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function computeBookingOutstanding(b: BookingOutstandingInput): BookingOutstanding {
  const { addons, interCityShipping, checkoutOneTimeFees, delayPenalty } =
    parseBookingPricingSnapshot(b.addonsJson);
  const effectiveRentalPrice = b.carModel
    ? resolveBookingRentalPricePerDayExclTax(b.carModel.price, b.addonsJson)
    : 0;
  const oneTimeFeesExclTax =
    (interCityShipping?.feeExclVatSar ?? 0) +
    checkoutOneTimeFees.reduce((s, x) => s + x.feeExclVatSar, 0) +
    (delayPenalty?.feeExclVatSar ?? 0);
  const totals = computeCheckoutTotals(
    effectiveRentalPrice,
    b.numberOfDays,
    b.carModel?.vatRatePercent ?? 15,
    addons.map((a) => ({ pricePerDay: a.pricePerDayExclTax })),
    { oneTimeFeesExclTax },
  );

  const statusKey = b.status.trim().toUpperCase();
  const psKey = b.paymentStatus.trim().toUpperCase();
  const terminal = statusKey === "CANCELLED" || statusKey === "REJECTED";
  const refunded = psKey === "REFUNDED" || psKey === "PARTIAL_REFUND";

  const remainingDue = Math.max(0, totals.totalInclTax - (b.paidAmountSar ?? 0));
  const outstandingDueSar = terminal || refunded ? 0 : round2(remainingDue);
  const balanceDueAtBranchSar =
    !terminal && typeof b.balanceDueAtBranchSar === "number"
      ? Math.max(0, round2(b.balanceDueAtBranchSar))
      : 0;

  return {
    totalInclTax: round2(totals.totalInclTax),
    outstandingDueSar,
    balanceDueAtBranchSar,
  };
}
