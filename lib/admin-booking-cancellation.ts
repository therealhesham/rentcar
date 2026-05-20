import type { AdminBookingDetail } from "@/lib/admin-booking-detail";
import { buildCancellationFinancePreview } from "@/lib/booking-cancellation-service";
import {
  getCustomerCancelMinHoursBeforePickup,
  getCustomerCancellationDeductTiers,
  getCustomerCancellationPolicyAr,
} from "@/lib/site-settings";

export async function loadAdminBookingCancellationContext(booking: AdminBookingDetail) {
  const [cancellationPolicyAr, cancelMinHoursBeforePickup, cancellationDeductTiers] =
    await Promise.all([
      getCustomerCancellationPolicyAr(),
      getCustomerCancelMinHoursBeforePickup(),
      getCustomerCancellationDeductTiers(),
    ]);

  const financePreview = buildCancellationFinancePreview({
    kind: booking.kind,
    status: booking.status,
    paymentStatus: booking.paymentStatus,
    paymentMethod: booking.paymentMethod,
    numberOfDays: booking.numberOfDays,
    pickupDate: booking.pickupDate,
    pricePerDayExclTax: booking.carModel?.price ?? null,
    vatRatePercent: booking.carModel?.vatRatePercent ?? null,
    addonsJson: booking.addonsJson,
    tiers: cancellationDeductTiers,
  });

  return {
    cancellationPolicyAr,
    cancelMinHoursBeforePickup,
    cancellationDeductTiers,
    cancellationFinancePreview: financePreview,
  };
}

export type AdminBookingCancellationContext = Awaited<
  ReturnType<typeof loadAdminBookingCancellationContext>
>;
