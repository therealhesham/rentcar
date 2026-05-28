import {
  isBookingPaymentMethod,
  type BookingPaymentMethod,
} from "@/lib/booking-payment-methods";

const LABELS_AR: Record<BookingPaymentMethod, string> = {
  CASH: "الدفع عند الفرع",
  CARD: "بطاقة ائتمانية",
  TABBY: "تابي",
  TAMARA: "تمارا",
  APPLE_PAY: "Apple Pay",
  POINTS: "استبدال نقاط",
};

/** تسمية عربية لوسيلة الدفع المخزّنة على الحجز. */
export function bookingPaymentMethodLabelAr(code: string | null | undefined): string {
  const key = code?.trim().toUpperCase() ?? "";
  if (isBookingPaymentMethod(key)) {
    return LABELS_AR[key];
  }
  return code?.trim() ? code : "—";
}
