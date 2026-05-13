"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { sendBookingInvoiceEmailAfterPayment } from "@/lib/booking-invoice-email";
import { prisma } from "@/lib/prisma";

export type ConfirmPaymentResult =
  | { ok: true; paymentMethod: string }
  | { ok: false; error: string };

const PAYMENT_METHODS = ["TABBY", "TAMARA", "CARD", "APPLE_PAY", "POINTS"] as const;

function parsePaymentMethod(formData: FormData): (typeof PAYMENT_METHODS)[number] | null {
  const raw = String(formData.get("paymentMethod") ?? "CARD")
    .trim()
    .toUpperCase();
  return PAYMENT_METHODS.includes(raw as (typeof PAYMENT_METHODS)[number])
    ? (raw as (typeof PAYMENT_METHODS)[number])
    : null;
}

/**
 * تأكيد دفع تجريبي: يضع `paymentStatus = PAID` و `paidAt = الآن` و`paymentMethod` على طلب الحجز.
 * جاهز لاحقاً لربط بوابات تابي / تمارا / بطاقة / Apple Pay / نقاط دون تغيير شكل الطلب.
 */
export async function confirmMockPayment(
  _prev: ConfirmPaymentResult | null,
  formData: FormData,
): Promise<ConfirmPaymentResult> {
  const id = Number(formData.get("bookingRequestId"));
  if (!Number.isInteger(id) || id < 1) {
    return { ok: false, error: "معرّف الطلب غير صالح." };
  }

  const paymentMethod = parsePaymentMethod(formData);
  if (!paymentMethod) {
    return { ok: false, error: "طريقة الدفع غير صالحة." };
  }

  try {
    const updated = await prisma.bookingRequest.updateMany({
      where: { id, kind: "DIRECT", paymentStatus: "PENDING" },
      data: {
        paymentStatus: "PAID",
        paidAt: new Date(),
        paymentMethod,
      },
    });
    if (updated.count === 0) {
      const exists = await prisma.bookingRequest.findUnique({
        where: { id },
        select: { paymentStatus: true, kind: true },
      });
      if (!exists || exists.kind !== "DIRECT") {
        return { ok: false, error: "الحجز غير موجود." };
      }
      if (exists.paymentStatus === "PAID") {
        const paidRow = await prisma.bookingRequest.findUnique({
          where: { id },
          select: { paymentMethod: true },
        });
        return {
          ok: true,
          paymentMethod: paidRow?.paymentMethod ?? paymentMethod,
        };
      }
      return { ok: false, error: "تعذّر تحديث حالة الدفع." };
    }

    try {
      await sendBookingInvoiceEmailAfterPayment(id);
    } catch (e) {
      console.error("[booking-invoice-email] بعد تأكيد الدفع:", e);
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { ok: false, error: "الحجز غير موجود." };
    }
    console.error(e);
    return { ok: false, error: "تعذّر تأكيد الدفع." };
  }

  revalidatePath(`/fleet/payment/${id}`);
  revalidatePath("/account");
  revalidatePath("/admin");
  revalidatePath("/admin/car-bookings");
  return { ok: true, paymentMethod };
}
