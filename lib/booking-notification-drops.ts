import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { BOOKING_EVENTS } from "@/lib/booking-audit";
import { sendNewBookingNotificationEmails } from "@/lib/booking-notification-email";
import { VISIBLE_BOOKINGS_WHERE } from "@/lib/booking-visibility";

const WINDOW_MS = 24 * 60 * 60 * 1000;
/** نتجاهل آخر ١٥ دقيقة حتى ما نزعجش عميل لسه في منتصف عملية الدفع فعلياً. */
const STALE_BUFFER_MS = 15 * 60 * 1000;

/** شرط "حجز بلا إشعار موظفين" — يشترك فيه كل من صفحة الأدمن وكرون المسح الدوري. */
export function droppedNotificationWhere(now: Date = new Date()): Prisma.BookingRequestWhereInput {
  return {
    createdAt: {
      gte: new Date(now.getTime() - WINDOW_MS),
      lte: new Date(now.getTime() - STALE_BUFFER_MS),
    },
    logs: { none: { event: BOOKING_EVENTS.STAFF_BOOKING_EMAIL_SENT } },
  };
}

/**
 * يفحص كل الحجوزات بلا إشعار موظفين خلال آخر ٢٤ ساعة (بلا نطاق فروع — مسح نظام كامل)
 * ويرسل الإشعار لكل واحد منها بنفس منطق الإرسال اليدوي (يتجاوز شرط اختيار وسيلة الدفع).
 * لا تلمس حالة الدفع إطلاقاً — الإرسال فقط، والعلامة في BookingLog تمنع التكرار بين
 * تشغيلات الكرون المتتالية. تُستدعى من `/api/cron/booking-notification-drops`.
 */
export async function sweepDroppedBookingNotifications(): Promise<{
  scanned: number;
  sent: number;
  sentIds: number[];
}> {
  const candidates = await prisma.bookingRequest.findMany({
    where: { ...VISIBLE_BOOKINGS_WHERE, ...droppedNotificationWhere() },
    select: { id: true },
    orderBy: { createdAt: "asc" },
    take: 500,
  });

  const sentIds: number[] = [];
  for (const { id } of candidates) {
    await sendNewBookingNotificationEmails(id, { bypassAwaitingPaymentChoice: true });
    const logged = await prisma.bookingLog.findFirst({
      where: { bookingId: id, event: BOOKING_EVENTS.STAFF_BOOKING_EMAIL_SENT },
      select: { id: true },
    });
    if (logged) sentIds.push(id);
  }

  return { scanned: candidates.length, sent: sentIds.length, sentIds };
}
