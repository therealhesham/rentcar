import "server-only";
import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { recordPaymentTransaction } from "@/lib/payment-transaction";
import { sendAdminEmailForNewBooking } from "@/lib/booking-received-notification";
import { sendBookingInvoiceEmailAfterPayment } from "@/lib/booking-invoice-email";
import { sendNewBookingNotificationEmails } from "@/lib/booking-notification-email";
import { sendBookingCompletionWhatsAppAfterPayment } from "@/lib/evolution-whatsapp";
import {
  bookingDaysPriceInputFromSnapshot,
  bookingTotalInclTaxForDays,
} from "@/lib/booking-edit";

/**
 * نظير lib/geidea/mark-paid.ts لكن مستقل بالكامل — بلا أي import من ملفات جيديا،
 * حتى الدوال الصغيرة (استخراج رقم الحجز من المرجع) مكتوبة من جديد هنا. حذف مجلد
 * lib/amkan بالكامل لا يكسر شيئاً في مسار جيديا/تابي.
 *
 * فارق جوهري عن جيديا: خدمة استعلام حالة الطلب عند إمكان لا ترجع مبلغاً إجمالياً،
 * فنعيد حساب المبلغ محلياً من لقطة الحجز بدل الاعتماد على رقم من البوابة.
 */

/** يستخرج رقم الحجز من merchantOrderCode/orderId بصيغة booking-{id}-{ts}. */
export function bookingIdFromAmkanReference(ref: string | null): number | null {
  const m = /^booking-(\d+)-\d+$/.exec(ref ?? "");
  if (!m) return null;
  const id = Number(m[1]);
  return Number.isInteger(id) && id >= 1 ? id : null;
}

/** إجمالي الحجز (شامل الضريبة) من لقطة الأسعار المخزّنة — مصدر المبلغ بدل رقم من إمكان. */
async function amkanBookingTotalInclTaxSar(bookingId: number): Promise<number | null> {
  const row = await prisma.bookingRequest.findFirst({
    where: { id: bookingId, kind: "DIRECT" },
    select: {
      snapshotTotalAmountSar: true,
      numberOfDays: true,
      addonsJson: true,
      carModel: { select: { price: true, vatRatePercent: true } },
    },
  });
  return (
    row?.snapshotTotalAmountSar ??
    (row?.carModel
      ? bookingTotalInclTaxForDays(
          bookingDaysPriceInputFromSnapshot(
            row.carModel.price,
            row.carModel.vatRatePercent,
            row.addonsJson,
          ),
          row.numberOfDays,
        )
      : null)
  );
}

/**
 * يُستدعى حين يُرفض إشعار مكتمل بسبب عدم تطابق المراجع. سببان مختلفان جذرياً:
 * إمّا محاولة تزوير (مرجع إمكان حقيقي مقرون برقم حجز آخر)، وإمّا حالة مشروعة —
 * العميل بدأ بإمكان ثم عاد واختار وسيلة أخرى فدهست `paymentSessionRef` (عمود
 * مشترك بين البوابات)، ثم أكمل تمويل إمكان بعدها. لا يمكن التمييز بينهما من هنا،
 * فيُسجَّل الحدث بوضوح للمراجعة اليدوية بدل تجاهله صامتاً — تجاهله يعني احتمال
 * ضياع دفعة حقيقية بلا أي أثر.
 */
async function warnIfAmkanReferenceMismatch(
  bookingId: number,
  gatewayOrderId: string,
  ourOrderId: string,
  source: "webhook" | "reconcile",
): Promise<void> {
  const row = await prisma.bookingRequest.findUnique({
    where: { id: bookingId },
    select: { paymentStatus: true, paymentSessionRef: true, paymentGatewayRef: true },
  });
  // غير موجود أو مدفوع أصلاً = تكرار طبيعي للإشعار، لا شيء يُبلَّغ عنه.
  if (!row || row.paymentStatus.trim().toUpperCase() === "PAID") return;
  if (row.paymentSessionRef === ourOrderId && row.paymentGatewayRef === gatewayOrderId) return;

  const detail =
    `إشعار إمكان مكتمل لم يُطبَّق — عدم تطابق المراجع. ` +
    `الوارد: session=${ourOrderId} gateway=${gatewayOrderId} — ` +
    `المسجَّل على الحجز: session=${row.paymentSessionRef ?? "—"} gateway=${row.paymentGatewayRef ?? "—"}`;
  console.error(`[amkan-${source}] booking=${bookingId} ${detail}`);
  await logActivity({
    kind: "BOOKING_PAYMENT",
    path: `/fleet/payment/${bookingId}`,
    actorLabel: `بوابة إمكان — إشعار مرفوض (عدم تطابق المراجع)`,
    detail,
  });
}

/**
 * يعلّم الحجز مدفوعاً من طلب إمكان مؤكَّد (COMPLETED عبر استعلام خادم‑لخادم).
 * التحديث idempotent (compare-and-swap): تكرار الإشعار أو تزامنه مع المصالحة لن
 * يحدّث السجل مرتين ولن يكرر الإشعارات.
 */
async function markBookingPaidFromAmkanOrder(
  bookingId: number,
  gatewayOrderId: string,
  ourOrderId: string,
  source: "webhook" | "reconcile",
): Promise<{ updated: boolean }> {
  const amountSar = await amkanBookingTotalInclTaxSar(bookingId);
  if (amountSar == null || amountSar <= 0) return { updated: false };

  const applied = await prisma.$transaction(async (tx) => {
    const updated = await tx.bookingRequest.updateMany({
      where: {
        id: bookingId,
        kind: "DIRECT",
        paymentStatus: { not: "PAID" },
        // رقم الحجز يصل من جسم الإشعار (`merchantOrderCode`)، و«حالة الطلب» عند
        // إمكان لا ترجع أي حقل يربط الطلب بالحجز — فلا شيء في رد البوابة يؤكّد
        // الاقتران. الربط الموثوق الوحيد هو ما سجّلناه نحن قبل التحويل، لذلك
        // يُطابَق المرجعان هنا: بدونهما يكفي إرسال orderCode مكتمل حقيقي مقروناً
        // برقم حجز آخر ليُعلَّم ذلك الحجز مدفوعاً. (جيديا محصَّنة تلقائياً لأنها
        // تُستعلَم بمرجعنا نحن فيعود رقم الحجز من ردٍّ متحقَّق منه.)
        paymentSessionRef: ourOrderId,
        paymentGatewayRef: gatewayOrderId,
      },
      data: {
        paymentStatus: "PAID",
        paidAt: new Date(),
        paidAmountSar: amountSar,
        paymentGatewayRef: gatewayOrderId,
        paymentMethod: "AMKAN",
        balanceDueAtBranchSar: null,
      },
    });
    if (updated.count === 0) return false;
    await recordPaymentTransaction(
      {
        bookingId,
        kind: "INITIAL_PAYMENT",
        amountSar,
        method: "AMKAN",
        actorKind: "GATEWAY",
        actorName: `إمكان (${source === "webhook" ? "إشعار" : "مصالحة"})`,
        gatewayRef: gatewayOrderId,
        sessionRef: ourOrderId,
      },
      tx,
    );
    return true;
  });

  if (!applied) {
    await warnIfAmkanReferenceMismatch(bookingId, gatewayOrderId, ourOrderId, source);
    return { updated: false };
  }

  await logActivity({
    kind: "BOOKING_PAYMENT",
    path: `/fleet/payment/${bookingId}`,
    actorLabel: `بوابة إمكان (${source === "webhook" ? "إشعار" : "مصالحة"}) — دفعة ${amountSar} ر.س (${gatewayOrderId})`,
  });

  try {
    await sendBookingInvoiceEmailAfterPayment(bookingId);
  } catch (e) {
    console.error(`[amkan-${source}] invoice email:`, e);
  }
  try {
    await sendAdminEmailForNewBooking(bookingId);
  } catch (e) {
    console.error(`[amkan-${source}] admin email:`, e);
  }
  try {
    await sendNewBookingNotificationEmails(bookingId);
  } catch (e) {
    console.error(`[amkan-${source}] staff notification email:`, e);
  }
  try {
    await sendBookingCompletionWhatsAppAfterPayment(bookingId);
  } catch (e) {
    console.error(`[amkan-${source}] whatsapp:`, e);
  }

  return { updated: true };
}

/**
 * دفعة رصيد (فرق تمديد) عبر إمكان لحجز مدفوع سابقاً. idempotent عبر CAS على قيمة
 * الرصيد + مرجع الجلسة المسجَّل على الحجز.
 */
async function markBookingBalancePaidFromAmkanOrder(
  bookingId: number,
  gatewayOrderId: string,
  ourOrderId: string,
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
  if (row.paymentSessionRef !== ourOrderId) return { updated: false };

  const applied = await prisma.$transaction(async (tx) => {
    const updated = await tx.bookingRequest.updateMany({
      where: {
        id: bookingId,
        paymentStatus: "PAID",
        balanceDueAtBranchSar: row.balanceDueAtBranchSar,
        paymentSessionRef: ourOrderId,
      },
      data: {
        paidAmountSar: (row.paidAmountSar ?? 0) + balance,
        balanceDueAtBranchSar: null,
        ...(row.paymentGatewayRef ? {} : { paymentGatewayRef: gatewayOrderId }),
      },
    });
    if (updated.count === 0) return false;
    await recordPaymentTransaction(
      {
        bookingId,
        kind: "BALANCE_PAYMENT",
        amountSar: balance,
        method: "AMKAN",
        actorKind: "GATEWAY",
        actorName: `إمكان (${source === "webhook" ? "إشعار" : "مصالحة"})`,
        gatewayRef: gatewayOrderId,
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
    actorLabel: `بوابة إمكان (${source === "webhook" ? "إشعار" : "مصالحة"}) — دفعة فرق تمديد ${balance} ر.س (${gatewayOrderId})`,
  });
  return { updated: true };
}

/**
 * يطبّق طلب إمكان مؤكَّداً (COMPLETED) على الحجز حسب حالته: دفعة أولى (قيد الدفع)
 * أو دفعة رصيد فرق تمديد (مدفوع وعليه رصيد).
 */
export async function applyCompletedAmkanOrderToBooking(
  bookingId: number,
  gatewayOrderId: string,
  ourOrderId: string,
  source: "webhook" | "reconcile",
): Promise<{ updated: boolean }> {
  const row = await prisma.bookingRequest.findUnique({
    where: { id: bookingId },
    select: { paymentStatus: true },
  });
  if (!row) return { updated: false };
  if (row.paymentStatus.trim().toUpperCase() === "PAID") {
    return markBookingBalancePaidFromAmkanOrder(bookingId, gatewayOrderId, ourOrderId, source);
  }
  return markBookingPaidFromAmkanOrder(bookingId, gatewayOrderId, ourOrderId, source);
}

/**
 * مصالحة عند عرض صفحة الدفع: إن كان الحجز قيد الدفع (أو عليه رصيد فرق تمديد) وله
 * جلسة إمكان سابقة، يُستعلم عن حالتها مباشرةً — يغطي عودة العميل قبل وصول الإشعار
 * أو تعطّله. لا يرمي أخطاء أبداً؛ فشل المصالحة لا يكسر عرض الصفحة.
 */
export async function reconcilePendingAmkanPaymentById(bookingRequestId: number): Promise<boolean> {
  try {
    const { fetchAmkanOrderStatus, isAmkanConfigured, isAmkanOrderCompleted } = await import(
      "@/lib/amkan/client"
    );
    if (!isAmkanConfigured()) return false;

    const booking = await prisma.bookingRequest.findUnique({
      where: { id: bookingRequestId },
      select: {
        paymentStatus: true,
        paymentMethod: true,
        paymentSessionRef: true,
        paymentGatewayRef: true,
        balanceDueAtBranchSar: true,
      },
    });
    if (!booking) return false;
    // `paymentGatewayRef` عمود مشترك بين البوابات: بدون هذا الحارس تُسأل إمكان عن
    // معرّف جيديا/تابي عند كل عرض لصفحة الدفع — نداء فاشل ومكلّف بلا فائدة.
    if ((booking.paymentMethod ?? "").trim().toUpperCase() !== "AMKAN") return false;
    if (!booking.paymentSessionRef || !booking.paymentGatewayRef) return false;
    const ps = booking.paymentStatus.trim().toUpperCase();
    const awaitingFirstPayment = ps === "PENDING";
    const awaitingBalancePayment = ps === "PAID" && (booking.balanceDueAtBranchSar ?? 0) > 0;
    if (!awaitingFirstPayment && !awaitingBalancePayment) return false;

    const order = await fetchAmkanOrderStatus(booking.paymentGatewayRef);
    if (!isAmkanOrderCompleted(order)) return false;
    const res = await applyCompletedAmkanOrderToBooking(
      bookingRequestId,
      booking.paymentGatewayRef,
      booking.paymentSessionRef,
      "reconcile",
    );
    return res.updated;
  } catch (e) {
    console.error("[amkan-reconcile] failed:", e);
    return false;
  }
}
