import "server-only";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { recordPaymentTransaction } from "@/lib/payment-transaction";
import { sendAdminEmailForNewBooking } from "@/lib/booking-received-notification";
import { sendBookingInvoiceEmailAfterPayment } from "@/lib/booking-invoice-email";
import { sendNewBookingNotificationEmails } from "@/lib/booking-notification-email";
import { sendBookingCompletionWhatsAppAfterPayment } from "@/lib/evolution-whatsapp";
import { fetchTabbyPayment, captureTabbyPayment, type TabbyPayment } from "@/lib/tabby/client";

/** يستخرج رقم الحجز من referenceId بصيغة booking-{id}-{ts}. */
export function bookingIdFromTabbyReference(ref: string | null): number | null {
  const m = /^booking-(\d+)-\d+$/.exec(ref ?? "");
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isInteger(id) && id >= 1 ? id : null;
}

/** الطلب مدفوع أو مصرح به لدى تابي بعملة صحيحة. */
export function isTabbyPaymentAuthorized(payment: TabbyPayment): boolean {
  const status = payment.status.trim().toUpperCase();
  return (
    (status === "AUTHORIZED" || status === "CLOSED") &&
    payment.currency.trim().toUpperCase() === "SAR" &&
    payment.amount > 0
  );
}

/**
 * يعلّم الحجز مدفوعاً من طلب تابي مؤكَّد (تم جلبه خادم‑لخادم).
 * التحديث idempotent (compare-and-swap).
 */
export async function markBookingPaidFromTabbyPayment(
  bookingId: number,
  payment: TabbyPayment,
  source: "webhook" | "reconcile",
): Promise<{ updated: boolean }> {
  // إدراج سطر الدفعة الأولى في دفتر الأستاذ ذرّياً مع تحديث الحجز.
  const applied = await prisma.$transaction(async (tx) => {
    const updated = await tx.bookingRequest.updateMany({
      where: { id: bookingId, kind: "DIRECT", paymentStatus: { not: "PAID" } },
      data: {
        paymentStatus: "PAID",
        paidAt: new Date(),
        paidAmountSar: payment.amount,
        paymentGatewayRef: payment.id,
        balanceDueAtBranchSar: null,
        paymentMethod: "TABBY",
      },
    });
    if (updated.count === 0) return false;
    await recordPaymentTransaction(
      {
        bookingId,
        kind: "INITIAL_PAYMENT",
        amountSar: payment.amount,
        method: "TABBY",
        actorKind: "GATEWAY",
        actorName: `تابي (${source === "webhook" ? "إشعار" : "مصالحة"})`,
        gatewayRef: payment.id,
        sessionRef: payment.orderReferenceId || payment.id,
      },
      tx,
    );
    return true;
  });

  if (!applied) return { updated: false };

  await logActivity({
    kind: "BOOKING_PAYMENT",
    path: `/fleet/payment/${bookingId}`,
    actorLabel: `بوابة تابي (${source === "webhook" ? "إشعار" : "مصالحة"}) — دفعة ${payment.amount} ر.س (${payment.id})`,
  });

  try {
    await sendBookingInvoiceEmailAfterPayment(bookingId);
  } catch (e) {
    console.error(`[tabby-${source}] invoice email:`, e);
  }
  try {
    await sendAdminEmailForNewBooking(bookingId);
  } catch (e) {
    console.error(`[tabby-${source}] admin email:`, e);
  }
  try {
    await sendNewBookingNotificationEmails(bookingId);
  } catch (e) {
    console.error(`[tabby-${source}] staff notification email:`, e);
  }
  try {
    await sendBookingCompletionWhatsAppAfterPayment(bookingId);
  } catch (e) {
    console.error(`[tabby-${source}] whatsapp:`, e);
  }

  return { updated: true };
}

/**
 * دفعة رصيد (فرق تمديد) عبر تابي لحجز مدفوع سابقاً.
 */
export async function markBookingBalancePaidFromTabbyPayment(
  bookingId: number,
  payment: TabbyPayment,
  source: "webhook" | "reconcile",
): Promise<{ updated: boolean }> {
  const row = await prisma.bookingRequest.findUnique({
    where: { id: bookingId },
    select: {
      paymentStatus: true,
      paidAmountSar: true,
      balanceDueAtBranchSar: true,
      paymentSessionRef: true,
      paymentGatewayRef: true,
    },
  });
  if (!row) return { updated: false };
  if (row.paymentStatus.trim().toUpperCase() !== "PAID") return { updated: false };
  const balance = row.balanceDueAtBranchSar ?? 0;
  if (balance <= 0) return { updated: false };

  const newBalance = Math.max(0, Math.round((balance - payment.amount) * 100) / 100);
  const applied = await prisma.$transaction(async (tx) => {
    const updated = await tx.bookingRequest.updateMany({
      where: {
        id: bookingId,
        paymentStatus: "PAID",
        balanceDueAtBranchSar: row.balanceDueAtBranchSar,
      },
      data: {
        paidAmountSar: (row.paidAmountSar ?? 0) + payment.amount,
        balanceDueAtBranchSar: newBalance > 0 ? newBalance : null,
        ...(row.paymentGatewayRef ? {} : { paymentGatewayRef: payment.id }),
      },
    });
    if (updated.count === 0) return false;
    await recordPaymentTransaction(
      {
        bookingId,
        kind: "BALANCE_PAYMENT",
        amountSar: payment.amount,
        method: "TABBY",
        actorKind: "GATEWAY",
        actorName: `تابي (${source === "webhook" ? "إشعار" : "مصالحة"})`,
        gatewayRef: payment.id,
        sessionRef: payment.orderReferenceId || payment.id,
        notes: "سداد فرق تمديد",
      },
      tx,
    );
    return true;
  });
  if (!applied) return { updated: false };

  await logActivity({
    kind: "BOOKING_PAYMENT",
    path: `/fleet/payment/${bookingId}`,
    actorLabel: `بوابة تابي (${source === "webhook" ? "إشعار" : "مصالحة"}) — دفعة فرق تمديد ${payment.amount} ر.س (${payment.id})`,
  });
  return { updated: true };
}

/**
 * يطبّق طلب تابي مؤكَّداً على الحجز حسب حالته.
 */
export async function applyAuthorizedTabbyPaymentToBooking(
  bookingId: number,
  payment: TabbyPayment,
  source: "webhook" | "reconcile",
): Promise<{ updated: boolean }> {
  // إذا كان المبلغ AUTHORIZED، نقوم بعمل capture له أولاً
  if (payment.status === "AUTHORIZED") {
    try {
      await captureTabbyPayment({
        paymentId: payment.id,
        amountSar: payment.amount,
        referenceId: `capture-${bookingId}`,
      });
      payment.status = "CLOSED";
    } catch (e) {
      console.error(`[tabby-${source}] capture failed:`, e);
    }
  }

  const row = await prisma.bookingRequest.findUnique({
    where: { id: bookingId },
    select: { paymentStatus: true },
  });
  if (!row) return { updated: false };
  if (row.paymentStatus.trim().toUpperCase() === "PAID") {
    return markBookingBalancePaidFromTabbyPayment(bookingId, payment, source);
  }
  return markBookingPaidFromTabbyPayment(bookingId, payment, source);
}

/**
 * مصالحة عند عودة العميل من صفحة تابي.
 */
export async function reconcilePendingTabbyPaymentById(
  bookingRequestId: number,
): Promise<boolean> {
  try {
    const { isTabbyConfigured } = await import("@/lib/tabby/client");
    if (!isTabbyConfigured()) return false;

    const booking = await prisma.bookingRequest.findUnique({
      where: { id: bookingRequestId },
      select: { paymentStatus: true, paymentSessionRef: true, balanceDueAtBranchSar: true },
    });
    if (!booking || !booking.paymentSessionRef) return false;

    const ps = booking.paymentStatus.trim().toUpperCase();
    const awaitingFirstPayment = ps === "PENDING";
    const awaitingBalancePayment = ps === "PAID" && (booking.balanceDueAtBranchSar ?? 0) > 0;
    if (!awaitingFirstPayment && !awaitingBalancePayment) return false;

    const payment = await fetchTabbyPayment(booking.paymentSessionRef);
    if (!payment || !isTabbyPaymentAuthorized(payment)) return false;
    const res = await applyAuthorizedTabbyPaymentToBooking(bookingRequestId, payment, "reconcile");
    return res.updated;
  } catch (e) {
    console.error("[tabby-reconcile] failed:", e);
    return false;
  }
}
