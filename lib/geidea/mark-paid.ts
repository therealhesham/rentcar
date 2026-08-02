import "server-only";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { recordPaymentTransaction } from "@/lib/payment-transaction";
import { sendAdminEmailForNewBooking } from "@/lib/booking-received-notification";
import { sendBookingInvoiceEmailAfterPayment } from "@/lib/booking-invoice-email";
import { sendNewBookingNotificationEmails } from "@/lib/booking-notification-email";
import { sendBookingCompletionWhatsAppAfterPayment } from "@/lib/evolution-whatsapp";
import type { GeideaOrder } from "@/lib/geidea/client";

/** يستخرج رقم الحجز من merchantReferenceId بصيغة booking-{id}-{ts}. */
export function bookingIdFromGeideaReference(ref: string | null): number | null {
  const m = /^booking-(\d+)-\d+$/.exec(ref ?? "");
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isInteger(id) && id >= 1 ? id : null;
}

/** الطلب مدفوع فعلاً لدى جيديا بعملة صحيحة. */
export function isGeideaOrderPaid(order: GeideaOrder): boolean {
  return (
    order.detailedStatus.trim().toLowerCase() === "paid" &&
    order.currency.trim().toUpperCase() === "SAR" &&
    order.amount > 0
  );
}

/** يحوّل ماركة جيديا (mada/visa/…) إلى وسيلة دفع بنظامنا — لمنفّذ الاسترداد. */
function bookingMethodFromGeideaBrand(brand: string | null): string | null {
  const b = (brand ?? "").trim().toLowerCase();
  if (!b) return null;
  if (b.includes("apple")) return "APPLE_PAY";
  if (b.includes("mada")) return "MADA";
  return "CARD";
}

/**
 * يعلّم الحجز مدفوعاً من طلب جيديا مؤكَّد (تم جلبه خادم‑لخادم — ليس من إشعار خام).
 * التحديث idempotent (compare-and-swap): الاستدعاء المتكرر من webhook + مصالحة
 * صفحة الدفع لن يحدّث السجل مرتين ولن يكرر الإشعارات.
 */
export async function markBookingPaidFromGeideaOrder(
  bookingId: number,
  order: GeideaOrder,
  source: "webhook" | "reconcile",
): Promise<{ updated: boolean }> {
  const gatewayMethod = bookingMethodFromGeideaBrand(order.paymentBrand);
  // إدراج سطر الدفعة الأولى في دفتر الأستاذ ذرّياً مع تحديث الحجز.
  const applied = await prisma.$transaction(async (tx) => {
    const updated = await tx.bookingRequest.updateMany({
      where: { id: bookingId, kind: "DIRECT", paymentStatus: { not: "PAID" } },
      data: {
        paymentStatus: "PAID",
        paidAt: new Date(),
        paidAmountSar: order.amount,
        paymentGatewayRef: order.orderId,
        balanceDueAtBranchSar: null,
        // وسيلة الدفع الفعلية من البوابة — يعتمد عليها منفّذ الاسترداد
        ...(gatewayMethod ? { paymentMethod: gatewayMethod } : {}),
      },
    });
    if (updated.count === 0) return false;
    await recordPaymentTransaction(
      {
        bookingId,
        kind: "INITIAL_PAYMENT",
        amountSar: order.amount,
        method: gatewayMethod,
        actorKind: "GATEWAY",
        actorName: `جيديا (${source === "webhook" ? "إشعار" : "مصالحة"})`,
        gatewayRef: order.orderId,
        sessionRef: order.merchantReferenceId,
      },
      tx,
    );
    return true;
  });

  if (!applied) return { updated: false };

  await logActivity({
    kind: "BOOKING_PAYMENT",
    path: `/fleet/payment/${bookingId}`,
    actorLabel: `بوابة جيديا (${source === "webhook" ? "إشعار" : "مصالحة"}) — دفعة ${order.amount} ر.س (${order.orderId})`,
  });

  try {
    await sendBookingInvoiceEmailAfterPayment(bookingId);
  } catch (e) {
    console.error(`[geidea-${source}] invoice email:`, e);
  }
  try {
    await sendAdminEmailForNewBooking(bookingId);
  } catch (e) {
    console.error(`[geidea-${source}] admin email:`, e);
  }
  // إشعار موظفي الفرع/المدينة — مؤجَّل لهنا لأن الحجز الإلكتروني وقت إنشائه
  // كان لسه غير مدفوع.
  try {
    await sendNewBookingNotificationEmails(bookingId);
  } catch (e) {
    console.error(`[geidea-${source}] staff notification email:`, e);
  }
  try {
    await sendBookingCompletionWhatsAppAfterPayment(bookingId);
  } catch (e) {
    console.error(`[geidea-${source}] whatsapp:`, e);
  }

  return { updated: true };
}

/**
 * دفعة رصيد (فرق تمديد) عبر جيديا لحجز مدفوع سابقاً: تُضاف للمدفوع ويُخفَّض
 * الرصيد المستحق. idempotent عبر CAS على قيمة الرصيد + مرجع الجلسة.
 */
export async function markBookingBalancePaidFromGeideaOrder(
  bookingId: number,
  order: GeideaOrder,
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
  // تُقبل فقط جلسة الرصيد الحالية المسجّلة على الحجز — إشعار قديم/مكرر لا يُحتسب.
  if (row.paymentSessionRef !== order.merchantReferenceId) return { updated: false };

  const newBalance = Math.max(0, Math.round((balance - order.amount) * 100) / 100);
  // دفعة الرصيد تُدرَج في الدفتر ذرّياً مع تحديث الرصيد المستحق.
  const applied = await prisma.$transaction(async (tx) => {
    const updated = await tx.bookingRequest.updateMany({
      where: {
        id: bookingId,
        paymentStatus: "PAID",
        balanceDueAtBranchSar: row.balanceDueAtBranchSar,
        paymentSessionRef: order.merchantReferenceId,
      },
      data: {
        paidAmountSar: (row.paidAmountSar ?? 0) + order.amount,
        balanceDueAtBranchSar: newBalance > 0 ? newBalance : null,
        // مرجع الدفعة الأصلية يبقى للاسترداد؛ يُملأ فقط إن كان فارغاً (حجوزات قديمة).
        ...(row.paymentGatewayRef ? {} : { paymentGatewayRef: order.orderId }),
      },
    });
    if (updated.count === 0) return false;
    await recordPaymentTransaction(
      {
        bookingId,
        kind: "BALANCE_PAYMENT",
        amountSar: order.amount,
        actorKind: "GATEWAY",
        actorName: `جيديا (${source === "webhook" ? "إشعار" : "مصالحة"})`,
        gatewayRef: order.orderId,
        sessionRef: order.merchantReferenceId,
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
    actorLabel: `بوابة جيديا (${source === "webhook" ? "إشعار" : "مصالحة"}) — دفعة فرق تمديد ${order.amount} ر.س (${order.orderId})`,
  });
  return { updated: true };
}

/**
 * يطبّق طلب جيديا مؤكَّداً على الحجز حسب حالته: دفعة أولى (قيد الدفع) أو
 * دفعة رصيد فرق تمديد (مدفوع وعليه رصيد).
 */
export async function applyPaidGeideaOrderToBooking(
  bookingId: number,
  order: GeideaOrder,
  source: "webhook" | "reconcile",
): Promise<{ updated: boolean }> {
  const row = await prisma.bookingRequest.findUnique({
    where: { id: bookingId },
    select: { paymentStatus: true },
  });
  if (!row) return { updated: false };
  if (row.paymentStatus.trim().toUpperCase() === "PAID") {
    return markBookingBalancePaidFromGeideaOrder(bookingId, order, source);
  }
  return markBookingPaidFromGeideaOrder(bookingId, order, source);
}

/**
 * مصالحة عند عرض صفحة الدفع: إن كان الحجز قيد الدفع (أو عليه رصيد فرق تمديد)
 * وله جلسة جيديا سابقة، يُستعلم عن حالتها مباشرةً — يغطي عودة العميل قبل وصول
 * الـ webhook أو تعطّله. لا يرمي أخطاء أبداً؛ فشل المصالحة لا يكسر عرض الصفحة.
 */
export async function reconcilePendingGeideaPaymentById(
  bookingRequestId: number,
): Promise<boolean> {
  try {
    const { fetchGeideaOrderByMerchantReference, isGeideaConfigured } = await import(
      "@/lib/geidea/client"
    );
    if (!isGeideaConfigured()) return false;

    const booking = await prisma.bookingRequest.findUnique({
      where: { id: bookingRequestId },
      select: { paymentStatus: true, paymentSessionRef: true, balanceDueAtBranchSar: true },
    });
    if (!booking) return false;
    if (!booking.paymentSessionRef) return false;
    const ps = booking.paymentStatus.trim().toUpperCase();
    const awaitingFirstPayment = ps === "PENDING";
    const awaitingBalancePayment = ps === "PAID" && (booking.balanceDueAtBranchSar ?? 0) > 0;
    if (!awaitingFirstPayment && !awaitingBalancePayment) return false;

    const order = await fetchGeideaOrderByMerchantReference(booking.paymentSessionRef);
    if (!order || !isGeideaOrderPaid(order)) return false;
    const res = await applyPaidGeideaOrderToBooking(bookingRequestId, order, "reconcile");
    return res.updated;
  } catch (e) {
    console.error("[geidea-reconcile] failed:", e);
    return false;
  }
}
