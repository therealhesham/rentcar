import type { BookingPaymentSnapshot } from "@/lib/booking-payment-data";

/** حالة الحجز: نقدي — بانتظار تأكيد الموظف هاتفياً. */
export const BOOKING_STATUS_UNDER_REVIEW = "UNDER_REVIEW";

export function isCashPaymentMethod(method: string | null | undefined): boolean {
  return method?.trim().toUpperCase() === "CASH";
}

export function isBookingUnderReview(status: string | null | undefined): boolean {
  return status?.trim().toUpperCase() === BOOKING_STATUS_UNDER_REVIEW;
}

/** العميل اختار الكاش وأكمل خطوة الدفع — لا نعيد عرض طرق الدفع. */
export function isCashCheckoutSubmitted(booking: {
  paymentMethod: string | null;
}): boolean {
  return isCashPaymentMethod(booking.paymentMethod);
}

export function isCashBookingConfirmed(status: string | null | undefined): boolean {
  return status?.trim().toUpperCase() === "CONFIRMED";
}

/** فاتورة PDF/HTML — إلكتروني بعد الدفع؛ نقدي بعد تأكيد الموظف (قادم). */
export function isInvoiceDeliveryReady(booking: {
  paymentMethod: string | null;
  paymentStatus: string;
  status: string;
}): boolean {
  if (isCashPaymentMethod(booking.paymentMethod)) {
    return booking.status.trim().toUpperCase() === "CONFIRMED";
  }
  return booking.paymentStatus.trim().toUpperCase() === "PAID";
}

/** «الإجمالي» للنقدي أو غير المدفوع — «الإجمالي المدفوع» بعد دفع إلكتروني/فوري. */
export function invoiceTotalLabelAr(booking: {
  paymentMethod: string | null;
  paymentStatus: string;
}): string {
  if (isCashPaymentMethod(booking.paymentMethod)) return "الإجمالي";
  if (booking.paymentStatus.trim().toUpperCase() !== "PAID") return "الإجمالي";
  return "الإجمالي المدفوع";
}

export function invoiceEmailHeaderForBooking(booking: BookingPaymentSnapshot): {
  badge: string;
  title: string;
  intro: string;
} {
  if (isCashPaymentMethod(booking.paymentMethod)) {
    const confirmed = booking.status.trim().toUpperCase() === "CONFIRMED";
    if (confirmed) {
      return {
        badge: "✓ تم تأكيد حجزكم",
        title: "فاتورة الحجز",
        intro:
          "شكراً لثقتكم واختياركم روائس. تم تأكيد حجزكم هاتفياً. مرفق مع هذه الرسالة نسخة PDF من الفاتورة للطباعة أو الأرشفة.",
      };
    }
    return {
      badge: "طلب نقدي — تحت المراجعة",
      title: "ملخص الحجز",
      intro:
        "شكراً لثقتكم واختياركم روائس. تم تسجيل طلبكم بالدفع نقداً. سيتواصل معكم فريقنا قريباً لتأكيد الحجز هاتفياً.",
    };
  }
  return {
    badge: "✓ تم الدفع بنجاح",
    title: "إيصال الدفع",
    intro:
      "شكراً لثقتكم واختياركم روائس. لقد تم استلام دفعتكم بنجاح وتم تأكيد حجزكم. مرفق مع هذه الرسالة نسخة PDF من الفاتورة الرسمية للطباعة أو الأرشفة.",
  };
}
