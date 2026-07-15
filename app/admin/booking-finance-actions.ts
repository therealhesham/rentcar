"use server";

import { revalidatePath } from "next/cache";
import {
  assertBookingRequestInScope,
  requireAdminForAction,
  requirePermissionForAction,
} from "@/lib/admin-access";
import { currentRequestMeta, logActivity } from "@/lib/activity-log";
import { isBookingPaymentMethod } from "@/lib/booking-payment-methods";
import { prisma } from "@/lib/prisma";

/** هامش تقريب للمقارنات المالية (كسور الهللة). */
const REFUND_EPS = 0.01;

export async function processBookingRefund(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requirePermissionForAction("FINANCIALS");
  if (!auth.ok) return { ok: false, error: auth.error };

  const bookingId = Number(formData.get("bookingId"));
  if (!Number.isInteger(bookingId) || bookingId < 1) {
    return { ok: false, error: "معرّف الطلب غير صالح." };
  }

  const scope = await assertBookingRequestInScope(auth.session, bookingId);
  if (!scope.ok) return { ok: false, error: scope.error };

  const amountStr = String(formData.get("amount")).trim();
  const amount = Number(amountStr);
  if (isNaN(amount) || amount <= 0) {
    return { ok: false, error: "يجب إدخال مبلغ استرداد صالح أكبر من صفر." };
  }

  const externalRef = String(formData.get("externalRef") || "").trim();

  const booking = await prisma.bookingRequest.findUnique({
    where: { id: bookingId },
    select: {
      paymentStatus: true,
      cancellationRefundAmountSar: true,
      paidAmountSar: true,
    },
  });

  if (!booking) return { ok: false, error: "الطلب غير موجود." };

  if (booking.paymentStatus === "REFUNDED") {
    return { ok: false, error: "الطلب مسترد بالكامل مسبقاً." };
  }

  const paid = booking.paidAmountSar ?? 0;
  if (paid <= 0) {
    return { ok: false, error: "لا يمكن استرداد حجز غير مدفوع." };
  }

  const alreadyRefunded = booking.cancellationRefundAmountSar ?? 0;
  const newRefundTotal = alreadyRefunded + amount;
  if (newRefundTotal > paid + REFUND_EPS) {
    const remaining = Math.max(0, Math.round((paid - alreadyRefunded) * 100) / 100);
    return {
      ok: false,
      error: `مبلغ الاسترداد يتجاوز المبلغ المدفوع (${paid} ر.س). المتبقي القابل للاسترداد: ${remaining} ر.س.`,
    };
  }

  // حالة الدفع النهائية تُشتق من المبالغ لا من الفورم: تغطية كامل المدفوع = REFUNDED.
  const fullyRefunded = newRefundTotal >= paid - REFUND_EPS;

  // قفل تفاؤلي (compare-and-swap): يُحدَّث السجل فقط إذا لم تتغيّر حالة الدفع
  // ولا قيمة الاسترداد منذ القراءة، لمنع الاسترداد المزدوج عند الطلبات المتزامنة.
  const res = await prisma.bookingRequest.updateMany({
    where: {
      id: bookingId,
      paymentStatus: { not: "REFUNDED" },
      cancellationRefundAmountSar: booking.cancellationRefundAmountSar,
    },
    data: {
      paymentStatus: fullyRefunded ? "REFUNDED" : "PARTIAL_REFUND",
      cancellationRefundAmountSar: newRefundTotal,
      cancellationRefundExternalRef: externalRef || "MOCK-FINANCE-REFUND",
    },
  });

  if (res.count === 0) {
    return {
      ok: false,
      error: "تعذّر تنفيذ الاسترداد — تم تحديث حالة الطلب من عملية أخرى. حدّث الصفحة وحاول مجدداً.",
    };
  }

  const meta = await currentRequestMeta();
  await logActivity({
    kind: "BOOKING_REFUND",
    path: `/admin/bookings/${bookingId}/finance`,
    actorLabel: `${auth.session.displayName} — استرداد ${amount} ر.س`,
    userId: auth.session.employeeId,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  revalidatePath("/admin/financials");
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath(`/admin/bookings/${bookingId}/finance`);

  return { ok: true };
}

export async function processBookingPayment(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const bookingId = Number(formData.get("bookingId"));
  if (!Number.isInteger(bookingId) || bookingId < 1) {
    return { ok: false, error: "معرّف الطلب غير صالح." };
  }

  const scope = await assertBookingRequestInScope(auth.session, bookingId);
  if (!scope.ok) return { ok: false, error: scope.error };

  const amountStr = String(formData.get("amount") ?? "").trim();
  const amount = Number(amountStr);
  if (isNaN(amount) || amount <= 0) {
    return { ok: false, error: "يجب إدخال مبلغ دفع صالح أكبر من صفر." };
  }

  const rawMethod = String(formData.get("paymentMethod") ?? "").trim().toUpperCase();
  if (!isBookingPaymentMethod(rawMethod)) {
    return { ok: false, error: "طريقة الدفع غير صالحة." };
  }

  const externalRef = String(formData.get("externalRef") ?? "").trim();
  const receivedBy  = String(formData.get("receivedBy")  ?? "").trim();

  const booking = await prisma.bookingRequest.findUnique({
    where: { id: bookingId },
    select: { paymentStatus: true, kind: true, balanceDueAtBranchSar: true, paidAmountSar: true },
  });

  if (!booking) return { ok: false, error: "الطلب غير موجود." };
  if (booking.kind !== "DIRECT") {
    return { ok: false, error: "تسجيل الدفع متاح للحجوزات المباشرة فقط." };
  }
  if (booking.paymentStatus === "PAID") {
    const balance = booking.balanceDueAtBranchSar ?? 0;
    if (balance <= 0) {
      return { ok: false, error: "الحجز مدفوع مسبقاً ولا توجد دفعة متبقية." };
    }
    if (amount > balance + REFUND_EPS) {
      return {
        ok: false,
        error: `مبلغ الدفعة يتجاوز المتبقي المستحق (${balance} ر.س).`,
      };
    }

    const newPaidAmount = (booking.paidAmountSar ?? 0) + amount;
    const newBalance = Math.max(0, Math.round((balance - amount) * 100) / 100);

    // قفل تفاؤلي: يُحدَّث السجل فقط إذا لم يتغيّر المتبقي منذ القراءة،
    // لمنع تسجيل الدفعة مرتين عند الطلبات المتزامنة.
    const res = await prisma.bookingRequest.updateMany({
      where: {
        id: bookingId,
        paymentStatus: "PAID",
        balanceDueAtBranchSar: booking.balanceDueAtBranchSar,
      },
      data: {
        paidAmountSar: newPaidAmount,
        balanceDueAtBranchSar: newBalance,
        // لا نُغيّر paymentMethod — وسيلة دفعة الرصيد قد تختلف عن الدفعة الأصلية.
      },
    });
    if (res.count === 0) {
      return {
        ok: false,
        error: "تعذّر تسجيل الدفعة — تم تحديث الطلب من عملية أخرى. حدّث الصفحة وحاول مجدداً.",
      };
    }
  } else {
    // قفل تفاؤلي: طلب واحد فقط يسجّل الدفعة الأولى.
    const res = await prisma.bookingRequest.updateMany({
      where: { id: bookingId, paymentStatus: { not: "PAID" } },
      data: {
        paymentStatus:    "PAID",
        paidAmountSar:    amount,
        paymentMethod:    rawMethod,
        paidAt:           new Date(),
        ...(externalRef ? { paymentExternalRef: externalRef } : {}),
        ...(receivedBy  ? { paymentReceivedBy: receivedBy }             : {}),
        balanceDueAtBranchSar: 0,
      },
    });
    if (res.count === 0) {
      return {
        ok: false,
        error: "تعذّر تسجيل الدفعة — الحجز مدفوع بالفعل من عملية أخرى. حدّث الصفحة.",
      };
    }
  }

  const meta = await currentRequestMeta();
  await logActivity({
    kind: "BOOKING_PAYMENT",
    path: `/admin/bookings/${bookingId}/finance`,
    actorLabel: `${auth.session.displayName} — دفعة ${amount} ر.س (${rawMethod})`,
    userId: auth.session.employeeId,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  revalidatePath("/admin/car-bookings");
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath(`/admin/bookings/${bookingId}/finance`);

  return { ok: true };
}
