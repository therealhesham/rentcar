import { prisma } from "@/lib/prisma";
import { bookingPaymentMethodLabelAr } from "@/lib/booking-payment-method-label";
import { isGeideaConfigured, refundGeideaPayment } from "@/lib/geidea/client";

export type CancellationRefundExecutionResult =
  | { ok: true; externalRef: string }
  | { ok: false; error: string };

/** وسائل تمرّ عبر بوابة جيديا (HPP يدعم مدى/البطاقات/Apple Pay). */
const GEIDEA_METHODS = new Set(["CARD", "MADA", "APPLE_PAY"]);

/**
 * يُنفَّذ الاسترداد حسب وسيلة الدفع:
 * - CARD/MADA/APPLE_PAY → Geidea Refund API على مرجع العملية الأصلية (paymentGatewayRef).
 * - CASH → لا استرداد إلكتروني؛ يُسلَّم نقداً في الفرع ويُسجَّل بمرجع يدوي.
 * - TABBY/TAMARA/POINTS → لم تُربط بعد؛ تُرفض صراحةً بدل استرداد وهمي.
 * - بدون مفاتيح جيديا (بيئة تطوير) → محاكاة كما قبل الربط.
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

  if (!isGeideaConfigured()) {
    console.info(
      `[booking-refund] simulated refund booking=${args.bookingRequestId} method=${method} (${label}) amountSar=${amount}`,
    );
    return {
      ok: true,
      externalRef: `MOCK-${method}-${args.bookingRequestId}-${Date.now()}`,
    };
  }

  if (method === "CASH") {
    return {
      ok: true,
      externalRef: `CASH-MANUAL-${args.bookingRequestId}-${Date.now()}`,
    };
  }

  if (GEIDEA_METHODS.has(method)) {
    const booking = await prisma.bookingRequest.findUnique({
      where: { id: args.bookingRequestId },
      select: { paymentGatewayRef: true },
    });
    if (!booking?.paymentGatewayRef) {
      return {
        ok: false,
        error:
          "لا يوجد مرجع دفع من البوابة لهذا الحجز — نفّذ الاسترداد من لوحة تاجر جيديا ثم سجّله يدوياً من صفحة العمليات المالية.",
      };
    }
    try {
      const res = await refundGeideaPayment({
        paymentGatewayRef: booking.paymentGatewayRef,
        amountSar: amount,
      });
      return { ok: true, externalRef: res.refundTransactionRef };
    } catch (e) {
      console.error(
        `[booking-refund] Geidea refund failed booking=${args.bookingRequestId}:`,
        e,
      );
      return {
        ok: false,
        error: "فشل تنفيذ الاسترداد عبر بوابة جيديا. حاول لاحقاً أو تواصل مع الدعم.",
      };
    }
  }

  return {
    ok: false,
    error: `الاسترداد الإلكتروني لوسيلة (${label}) غير مربوط بعد — نفّذه لدى المزوّد ثم سجّله يدوياً من صفحة العمليات المالية.`,
  };
}
