"use server";

import { revalidatePath } from "next/cache";
import { assertBookingRequestInScope, requireAdminForAction } from "@/lib/admin-access";
import { isBookingPaymentMethod } from "@/lib/booking-payment-methods";
import { prisma } from "@/lib/prisma";

export async function processBookingRefund(
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

  const amountStr = String(formData.get("amount")).trim();
  const amount = Number(amountStr);
  if (isNaN(amount) || amount <= 0) {
    return { ok: false, error: "يجب إدخال مبلغ استرداد صالح أكبر من صفر." };
  }

  const isPartial = formData.get("isPartial") === "true";
  const externalRef = String(formData.get("externalRef") || "").trim();

  const booking = await prisma.bookingRequest.findUnique({
    where: { id: bookingId },
    select: { paymentStatus: true, cancellationRefundAmountSar: true }
  });

  if (!booking) return { ok: false, error: "الطلب غير موجود." };

  if (booking.paymentStatus === "REFUNDED") {
    return { ok: false, error: "الطلب مسترد بالكامل مسبقاً." };
  }

  const newRefundTotal = (booking.cancellationRefundAmountSar || 0) + amount;

  await prisma.bookingRequest.update({
    where: { id: bookingId },
    data: {
      paymentStatus: isPartial ? "PARTIAL_REFUND" : "REFUNDED",
      cancellationRefundAmountSar: newRefundTotal,
      cancellationRefundExternalRef: externalRef || "MOCK-FINANCE-REFUND",
    }
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
    select: { paymentStatus: true, kind: true },
  });

  if (!booking) return { ok: false, error: "الطلب غير موجود." };
  if (booking.kind !== "DIRECT") {
    return { ok: false, error: "تسجيل الدفع متاح للحجوزات المباشرة فقط." };
  }
  if (booking.paymentStatus === "PAID") {
    return { ok: false, error: "الحجز مدفوع مسبقاً." };
  }
  if (booking.paymentStatus === "REFUNDED") {
    return { ok: false, error: "الحجز مسترد ولا يمكن تسجيل دفعة عليه." };
  }

  await prisma.bookingRequest.update({
    where: { id: bookingId },
    data: {
      paymentStatus:    "PAID",
      paidAmountSar:    amount,
      paymentMethod:    rawMethod,
      paidAt:           new Date(),
      ...(externalRef ? { cancellationRefundExternalRef: externalRef } : {}),
      ...(receivedBy  ? { paymentReceivedBy: receivedBy }             : {}),
    },
  });

  revalidatePath("/admin/car-bookings");
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath(`/admin/bookings/${bookingId}/finance`);

  return { ok: true };
}
