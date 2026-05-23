"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import {
  resendBookingInvoiceEmail,
  sendBookingInvoiceEmailAfterPayment,
  type ResendBookingInvoiceResult,
} from "@/lib/booking-invoice-email";
import { sendBookingCompletionWhatsAppAfterPayment } from "@/lib/evolution-whatsapp";
import { prisma } from "@/lib/prisma";

export type ConfirmPaymentResult =
  | { ok: true; paymentMethod: string }
  | { ok: false; error: string };

import {
  CUSTOMER_CHECKOUT_PAYMENT_METHODS,
  isCheckoutPaymentMethodEnabled,
  type CustomerCheckoutPaymentMethod,
} from "@/lib/checkout-payment-method-flags";
import { getCheckoutPaymentMethodFlags } from "@/lib/site-settings";

function parsePaymentMethod(formData: FormData): CustomerCheckoutPaymentMethod | null {
  const raw = String(formData.get("paymentMethod") ?? "CARD")
    .trim()
    .toUpperCase();
  return (CUSTOMER_CHECKOUT_PAYMENT_METHODS as readonly string[]).includes(raw)
    ? (raw as CustomerCheckoutPaymentMethod)
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

  const methodFlags = await getCheckoutPaymentMethodFlags();
  if (!isCheckoutPaymentMethodEnabled(methodFlags, paymentMethod)) {
    return { ok: false, error: "طريقة الدفع غير متاحة حالياً." };
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

    try {
      await sendBookingCompletionWhatsAppAfterPayment(id);
    } catch (e) {
      console.error("[evolution-whatsapp] بعد تأكيد الدفع:", e);
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

export async function resendBookingInvoice(
  _prev: ResendBookingInvoiceResult | null,
  formData: FormData,
): Promise<ResendBookingInvoiceResult> {
  const id = Number(formData.get("bookingRequestId"));
  if (!Number.isInteger(id) || id < 1) {
    return { ok: false, error: "معرّف الطلب غير صالح." };
  }

  const exists = await prisma.bookingRequest.findUnique({
    where: { id },
    select: { kind: true },
  });
  if (!exists || exists.kind !== "DIRECT") {
    return { ok: false, error: "الحجز غير موجود." };
  }

  return resendBookingInvoiceEmail(id);
}
