"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { BOOKING_STATUS_UNDER_REVIEW } from "@/lib/booking-cash-flow";
import { sendBookingReceivedNotification } from "@/lib/booking-received-notification";
import {
  resendBookingInvoiceEmail,
  sendBookingInvoiceEmailAfterPayment,
  type ResendBookingInvoiceResult,
} from "@/lib/booking-invoice-email";
import {
  customerBookingOwnershipWhere,
  requireCustomerBookingActionAccess,
} from "@/lib/customer-booking-access";
import { getCustomerProfile } from "@/lib/customer-auth";
import { sendBookingCompletionWhatsAppAfterPayment } from "@/lib/evolution-whatsapp";
import { prisma } from "@/lib/prisma";

export type ConfirmPaymentResult =
  | { ok: true; paymentMethod: string; underReview?: boolean }
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

  const access = await requireCustomerBookingActionAccess(id);
  if (!access.ok) return { ok: false, error: access.error };

  const profile = await getCustomerProfile();
  if (!profile) {
    return { ok: false, error: "يجب تسجيل الدخول لإتمام هذه العملية." };
  }

  const isCash = paymentMethod === "CASH";

  try {
    const updated = await prisma.bookingRequest.updateMany({
      where: {
        id,
        kind: "DIRECT",
        paymentStatus: "PENDING",
        ...(isCash ? { paymentMethod: null } : {}),
        ...customerBookingOwnershipWhere(profile.id, profile.phone),
      },
      data: isCash
        ? {
            paymentMethod,
            paymentStatus: "PENDING",
            paidAt: null,
            status: BOOKING_STATUS_UNDER_REVIEW,
          }
        : {
            paymentStatus: "PAID",
            paidAt: new Date(),
            paymentMethod,
          },
    });
    if (updated.count === 0) {
      const exists = await prisma.bookingRequest.findFirst({
        where: {
          id,
          kind: "DIRECT",
          ...customerBookingOwnershipWhere(profile.id, profile.phone),
        },
        select: { paymentStatus: true, paymentMethod: true, status: true },
      });
      if (!exists) {
        return { ok: false, error: "الحجز غير موجود أو لا يخص حسابك." };
      }
      const existingMethod = exists.paymentMethod?.trim().toUpperCase() ?? "";
      if (existingMethod === "CASH") {
        return {
          ok: true,
          paymentMethod: "CASH",
          underReview: exists.status.trim().toUpperCase() === BOOKING_STATUS_UNDER_REVIEW,
        };
      }
      if (exists.paymentStatus === "PAID") {
        const paidRow = await prisma.bookingRequest.findFirst({
          where: {
            id,
            ...customerBookingOwnershipWhere(profile.id, profile.phone),
          },
          select: { paymentMethod: true },
        });
        return {
          ok: true,
          paymentMethod: paidRow?.paymentMethod ?? paymentMethod,
        };
      }
      return { ok: false, error: "تعذّر تحديث حالة الدفع." };
    }

    if (isCash) {
      try {
        await sendBookingReceivedNotification(id);
      } catch (e) {
        console.error("[booking-received] بعد تسجيل الكاش:", e);
      }
    } else {
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
  return { ok: true, paymentMethod, underReview: isCash };
}

export async function resendBookingInvoice(
  _prev: ResendBookingInvoiceResult | null,
  formData: FormData,
): Promise<ResendBookingInvoiceResult> {
  const id = Number(formData.get("bookingRequestId"));
  if (!Number.isInteger(id) || id < 1) {
    return { ok: false, error: "معرّف الطلب غير صالح." };
  }

  const access = await requireCustomerBookingActionAccess(id);
  if (!access.ok) return access;

  return resendBookingInvoiceEmail(id);
}
