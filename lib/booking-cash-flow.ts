import type { BookingPaymentSnapshot } from "@/lib/booking-payment-data";
import { isBookingReturned } from "@/lib/booking-lifecycle";

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

/** رابط «إتمام الدفع» في حساب العميل — لا يُعرض عند الدفع عند الفرع (يُدفع في الفرع). */
export function shouldShowCompletePaymentLink(booking: {
  kind: string;
  paymentStatus: string;
  paymentMethod?: string | null;
}): boolean {
  if (booking.kind !== "DIRECT") return false;
  if (booking.paymentStatus.trim().toUpperCase() !== "PENDING") return false;
  if (isCashPaymentMethod(booking.paymentMethod)) return false;
  return true;
}

export function isCashBookingConfirmed(status: string | null | undefined): boolean {
  return status?.trim().toUpperCase() === "CONFIRMED";
}

/** فاتورة PDF/HTML — إلكتروني بعد الدفع؛ نقدي بعد إرجاع السيارة إلى الفرع. */
export function isInvoiceDeliveryReady(booking: {
  paymentMethod: string | null;
  paymentStatus: string;
  status: string;
}): boolean {
  if (isCashPaymentMethod(booking.paymentMethod)) {
    return isBookingReturned(booking.status);
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
    if (isBookingReturned(booking.status)) {
      return {
        badge: "✓ تم إرجاع المركبة والدفع",
        title: "فاتورة الحجز",
        intro:
          "شكراً لثقتكم واختياركم روائس. تم تسجيل إرجاع المركبة وتأكيد الدفع عند الفرع. مرفق مع هذه الرسالة نسخة PDF من الفاتورة للطباعة أو الأرشفة.",
      };
    }
    const confirmed = booking.status.trim().toUpperCase() === "CONFIRMED";
    if (confirmed) {
      return {
        badge: "✓ تم تأكيد حجزكم",
        title: "ملخص الحجز",
        intro:
          "شكراً لثقتكم واختياركم روائس. تم تأكيد حجزكم. ستُرسل الفاتورة إلى بريدكم بعد إرجاع المركبة إلى الفرع.",
      };
    }
    return {
      badge: "الدفع عند الفرع — تحت المراجعة",
      title: "ملخص الحجز",
      intro:
        "شكراً لثقتكم واختياركم روائس. تم تسجيل طلبكم بالدفع عند الفرع. سيتواصل معكم فريقنا قريباً لتأكيد الحجز هاتفياً.",
    };
  }
  return {
    badge: "✓ تم الدفع بنجاح",
    title: "إيصال الدفع",
    intro:
      "شكراً لثقتكم واختياركم روائس. لقد تم استلام دفعتكم بنجاح وتم تأكيد حجزكم. مرفق مع هذه الرسالة نسخة PDF من الفاتورة الرسمية للطباعة أو الأرشفة.",
  };
}
