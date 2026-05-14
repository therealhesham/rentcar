import { bookingPaymentMethodLabelAr } from "@/lib/booking-payment-method-label";

export type CancellationRefundExecutionResult =
  | { ok: true; externalRef: string }
  | { ok: false; error: string };

/**
 * يُنفَّذ الاسترداد حسب وسيلة الدفع. حالياً محاكاة ناجحة — استبدل الفروع بنداءات تابي / تمارا / البوابة عند الربط.
 */
export async function executeCancellationRefundByPaymentMethod(args: {
  bookingRequestId: number;
  paymentMethod: string | null;
  refundAmountInclTaxSar: number;
}): Promise<CancellationRefundExecutionResult> {
  const amount = Math.round(args.refundAmountInclTaxSar * 100) / 100;
  if (amount <= 0) {
    return { ok: true, externalRef: `NONE-${args.bookingRequestId}` };
  }

  const method = (args.paymentMethod ?? "").trim().toUpperCase() || "UNKNOWN";
  const label = bookingPaymentMethodLabelAr(method);

  // TODO: استبدل بنداءات API حقيقية لكل وسيلة (TABBY / TAMARA / Stripe / …).
  console.info(
    `[booking-refund] simulated refund booking=${args.bookingRequestId} method=${method} (${label}) amountSar=${amount}`,
  );

  const externalRef = `MOCK-${method}-${args.bookingRequestId}-${Date.now()}`;
  return { ok: true, externalRef };
}
