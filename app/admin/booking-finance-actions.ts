"use server";

import { revalidatePath } from "next/cache";
import {
  assertBookingRequestInScope,
  requireAdminForAction,
  requirePermissionForAction,
} from "@/lib/admin-access";
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

  const isPartial = formData.get("isPartial") === "true";
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

  // قفل تفاؤلي (compare-and-swap): يُحدَّث السجل فقط إذا لم تتغيّر حالة الدفع
  // ولا قيمة الاسترداد منذ القراءة، لمنع الاسترداد المزدوج عند الطلبات المتزامنة.
  const res = await prisma.bookingRequest.updateMany({
    where: {
      id: bookingId,
      paymentStatus: { not: "REFUNDED" },
      cancellationRefundAmountSar: booking.cancellationRefundAmountSar,
    },
    data: {
      paymentStatus: isPartial ? "PARTIAL_REFUND" : "REFUNDED",
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
    if ((booking.balanceDueAtBranchSar ?? 0) <= 0) {
      return { ok: false, error: "الحجز مدفوع مسبقاً ولا توجد دفعة متبقية." };
    }
    
    // Pay balance
    const newPaidAmount = (booking.paidAmountSar ?? 0) + amount;
    const newBalance = (booking.balanceDueAtBranchSar ?? 0) - amount;

    await prisma.bookingRequest.update({
      where: { id: bookingId },
      data: {
        paidAmountSar: newPaidAmount,
        balanceDueAtBranchSar: newBalance > 0 ? newBalance : 0,
        // optionally update paymentMethod, but since they might be different, let's just record it.
      },
    });
  } else {
    await prisma.bookingRequest.update({
      where: { id: bookingId },
      data: {
        paymentStatus:    "PAID",
        paidAmountSar:    amount,
        paymentMethod:    rawMethod,
        paidAt:           new Date(),
        ...(externalRef ? { cancellationRefundExternalRef: externalRef } : {}),
        ...(receivedBy  ? { paymentReceivedBy: receivedBy }             : {}),
        balanceDueAtBranchSar: 0,
      },
    });
  }

  revalidatePath("/admin/car-bookings");
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath(`/admin/bookings/${bookingId}/finance`);

  return { ok: true };
}
