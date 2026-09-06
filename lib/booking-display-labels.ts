/** تسميات عربية موحّدة لعرض حالة الحجز والدفع في الواجهات. */

export const BOOKING_STATUS_LABELS_AR: Record<string, string> = {
  NEW: "جديد",
  UNDER_REVIEW: "تحت المراجعة",
  CONTACTED: "تم التواصل",
  CONFIRMED: "قادم",
  PICKED_UP: "استلام السيارة من الفرع",
  RETURNED: "تسليم السيارة إلى الفرع",
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

/** نظائر إنجليزية — للواجهات المواجهة للعميل فقط؛ لوحة الإدارة تبقى عربية. */
export const BOOKING_STATUS_LABELS_EN: Record<string, string> = {
  NEW: "New",
  UNDER_REVIEW: "Under review",
  CONTACTED: "Contacted",
  CONFIRMED: "Upcoming",
  PICKED_UP: "Picked up from branch",
  RETURNED: "Returned to branch",
  CANCELLED: "Cancelled",
  REJECTED: "Rejected",
  COMPLETED: "Completed",
};

export const BOOKING_PAYMENT_STATUS_LABELS_EN: Record<string, string> = {
  PAID: "Paid",
  PENDING: "Awaiting payment",
  REFUNDED: "Refunded",
  PARTIAL_REFUND: "Partially refunded",
  NO_REFUND: "No refund",
};

export function bookingStatusLabel(status: string, locale: string = "ar"): string {
  const key = status.trim().toUpperCase();
  const map = locale === "en" ? BOOKING_STATUS_LABELS_EN : BOOKING_STATUS_LABELS_AR;
  return map[key] ?? status;
}

export function bookingPaymentStatusLabel(status: string, locale: string = "ar"): string {
  const key = status.trim().toUpperCase();
  const map = locale === "en" ? BOOKING_PAYMENT_STATUS_LABELS_EN : BOOKING_PAYMENT_STATUS_LABELS_AR;
  return map[key] ?? status;
}
