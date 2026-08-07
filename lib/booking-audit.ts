import { prisma } from "@/lib/prisma";

export type BookingActorKind = "CUSTOMER" | "ADMIN" | "SYSTEM";

export type BookingEventInput = {
  bookingId: number;
  event: BookingEvent;
  actorKind: BookingActorKind;
  actorName?: string;
  fromStatus?: string;
  toStatus?: string;
  notes?: string;
  meta?: Record<string, unknown>;
};

export const BOOKING_EVENTS = {
  BOOKING_CREATED: "BOOKING_CREATED",
  BOOKING_UPDATED: "BOOKING_UPDATED",
  STATUS_CHANGED: "STATUS_CHANGED",
  PAYMENT_RECORDED: "PAYMENT_RECORDED",
  BALANCE_PAID: "BALANCE_PAID",
  PAYMENT_CONFIRMED: "PAYMENT_CONFIRMED",
  REFUND_PROCESSED: "REFUND_PROCESSED",
  CUSTOMER_DUES_SETTLED: "CUSTOMER_DUES_SETTLED",
  EXTRA_CHARGE_ADDED: "EXTRA_CHARGE_ADDED",
  EXTRA_CHARGE_VOIDED: "EXTRA_CHARGE_VOIDED",
  VEHICLE_PICKED_UP: "VEHICLE_PICKED_UP",
  VEHICLE_RETURNED: "VEHICLE_RETURNED",
  BOOKING_CANCELLED: "BOOKING_CANCELLED",
  CUSTOMER_CANCELLED: "CUSTOMER_CANCELLED",
  CONVERTED_TO_DIRECT: "CONVERTED_TO_DIRECT",
  REVERTED_TO_INQUIRY: "REVERTED_TO_INQUIRY",
  INTER_BRANCH_RETURN: "INTER_BRANCH_RETURN",
  MIN_PRICE_FLOOR_APPLIED: "MIN_PRICE_FLOOR_APPLIED",
  MIN_PRICE_FLOOR_BYPASSED: "MIN_PRICE_FLOOR_BYPASSED",
} as const;

export type BookingEvent = (typeof BOOKING_EVENTS)[keyof typeof BOOKING_EVENTS];

export const BOOKING_EVENT_LABELS: Record<BookingEvent, string> = {
  BOOKING_CREATED: "إنشاء الحجز",
  BOOKING_UPDATED: "تعديل الحجز",
  STATUS_CHANGED: "تغيير الحالة",
  PAYMENT_RECORDED: "تسجيل دفعة",
  BALANCE_PAID: "سداد رصيد مستحق",
  PAYMENT_CONFIRMED: "تأكيد الدفع",
  REFUND_PROCESSED: "استرداد مبلغ",
  CUSTOMER_DUES_SETTLED: "تسوية مستحقات للعميل",
  EXTRA_CHARGE_ADDED: "إضافة رسوم إضافية",
  EXTRA_CHARGE_VOIDED: "إلغاء رسوم إضافية",
  VEHICLE_PICKED_UP: "استلام المركبة",
  VEHICLE_RETURNED: "إرجاع المركبة",
  BOOKING_CANCELLED: "إلغاء الحجز",
  CUSTOMER_CANCELLED: "إلغاء ذاتي من العميل",
  CONVERTED_TO_DIRECT: "تحويل لحجز مباشر",
  REVERTED_TO_INQUIRY: "إعادة لطلب استفسار",
  INTER_BRANCH_RETURN: "تأكيد إرجاع بين الفروع",
  MIN_PRICE_FLOOR_APPLIED: "تفعيل الحد الأدنى للسعر",
  MIN_PRICE_FLOOR_BYPASSED: "تجاوز الحد الأدنى بتصريح",
};

export async function logBookingEvent(input: BookingEventInput): Promise<void> {
  try {
    await prisma.bookingLog.create({
      data: {
        bookingId: input.bookingId,
        event: input.event,
        actorKind: input.actorKind,
        actorName: input.actorName,
        fromStatus: input.fromStatus?.trim().toUpperCase() || null,
        toStatus: input.toStatus?.trim().toUpperCase() || null,
        notes: input.notes || null,
        metaJson: input.meta ? JSON.stringify(input.meta) : null,
      },
    });
  } catch {
    // الـ log لا يوقف العملية الأساسية إذا فشل
  }
}
