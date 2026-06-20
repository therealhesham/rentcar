"use server";

import { requireAdminForAction } from "@/lib/admin-access";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sendBookingCompletionWhatsAppAfterPayment } from "@/lib/evolution-whatsapp";
import { computeCheckoutTotals } from "@/lib/booking-checkout-pricing";
import { parseBookingPricingSnapshot, resolveBookingRentalPricePerDayExclTax } from "@/lib/booking-pricing-snapshot";

export async function markBookingAsPaid(_prev: any, formData: FormData) {
  const auth = await requireAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const bookingId = Number(formData.get("bookingId"));
  const method = String(formData.get("paymentMethod") || "CASH");

  if (bookingId > 0) {
    try {
      const beforeUpdate = await prisma.bookingRequest.findUnique({
        where: { id: bookingId },
        select: {
          status: true,
          kind: true,
          numberOfDays: true,
          addonsJson: true,
          carModel: { select: { price: true, vatRatePercent: true } },
        },
      });

      // حساب المبلغ الكامل شامل الضريبة
      let paidAmountSar: number | null = null;
      if (beforeUpdate?.carModel) {
        const { addons, interCityShipping, checkoutOneTimeFees } = parseBookingPricingSnapshot(beforeUpdate.addonsJson);
        const effectivePrice = resolveBookingRentalPricePerDayExclTax(beforeUpdate.carModel.price, beforeUpdate.addonsJson);
        const shipFee = interCityShipping?.feeExclVatSar ?? 0;
        const feesSum = checkoutOneTimeFees.reduce((s, x) => s + x.feeExclVatSar, 0);
        const totals = computeCheckoutTotals(
          effectivePrice,
          beforeUpdate.numberOfDays,
          beforeUpdate.carModel.vatRatePercent,
          addons.map((a) => ({ pricePerDay: a.pricePerDayExclTax })),
          { oneTimeFeesExclTax: shipFee + feesSum },
        );
        paidAmountSar = totals.totalInclTax;
      }

      await prisma.bookingRequest.update({
        where: { id: bookingId },
        data: {
          paymentStatus: "PAID",
          paymentMethod: method,
          paidAt: new Date(),
          paymentReceivedBy: auth.session.displayName,
          status: "CONFIRMED",
          paidAmountSar,
        },
      });

      const wasNotConfirmed = beforeUpdate?.status.trim().toUpperCase() !== "CONFIRMED";
      const isDirect = beforeUpdate?.kind === "DIRECT";

      if (wasNotConfirmed && isDirect) {
        try {
          await sendBookingCompletionWhatsAppAfterPayment(bookingId);
        } catch (e) {
          console.error("[evolution-whatsapp] بعد تسجيل الدفع من المالية:", e);
        }
      }

      revalidatePath("/admin/financials");
      revalidatePath(`/admin/bookings/${bookingId}`);
      return { ok: true };
    } catch (e) {
      console.error("[markBookingAsPaid] error:", e);
      return { ok: false, error: "حدث خطأ أثناء تحديث حالة الدفع." };
    }
  }
  return { ok: false, error: "رقم الحجز غير صالح." };
}
