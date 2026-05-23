/** تسميات عربية موحّدة لعرض حالة الحجز والدفع في الواجهات. */

export const BOOKING_STATUS_LABELS_AR: Record<string, string> = {
  NEW: "جديد",
  UNDER_REVIEW: "تحت المراجعة",
  CONTACTED: "تم التواصل",
  CONFIRMED: "قادم",
  CANCELLED: "ملغى",
  REJECTED: "مرفوض",
  COMPLETED: "مكتمل",
};

export const BOOKING_PAYMENT_STATUS_LABELS_AR: Record<string, string> = {
  PAID: "مدفوع",
  PENDING: "قيد الدفع",
  REFUNDED: "مسترد",
  PARTIAL_REFUND: "استرداد جزئي",
  NO_REFUND: "بدون استرداد",
};

export function bookingStatusLabelAr(status: string): string {
  return BOOKING_STATUS_LABELS_AR[status.trim().toUpperCase()] ?? status;
}

export function bookingPaymentStatusLabelAr(status: string): string {
  return BOOKING_PAYMENT_STATUS_LABELS_AR[status.trim().toUpperCase()] ?? status;
}
