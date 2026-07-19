"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { Prisma } from "@prisma/client";
import {
  createGeideaCheckoutSession,
  isGeideaConfigured,
} from "@/lib/geidea/client";
import { BOOKING_STATUS_UNDER_REVIEW } from "@/lib/booking-cash-flow";
import { sendBookingReceivedNotification, sendAdminEmailForNewBooking } from "@/lib/booking-received-notification";
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
import { hasBookingPickupPassed } from "@/lib/booking-lifecycle";
import { logActivity } from "@/lib/activity-log";
import { sendBookingCompletionWhatsAppAfterPayment } from "@/lib/evolution-whatsapp";
import {
  bookingDaysPriceInputFromSnapshot,
  bookingTotalInclTaxForDays,
} from "@/lib/booking-edit";
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

  // بوابة الحالة/الموعد: لا يُسمح بإتمام الدفع لحجز ملغى/مرفوض أو بدأ موعد استلامه بالفعل،
  // بصرف النظر عن حالة الدفع المسجّلة (منعاً لدفع حجز قديم منتهٍ عبر رابط قديم).
  const bookingGate = await prisma.bookingRequest.findFirst({
    where: {
      id,
      kind: "DIRECT",
      ...customerBookingOwnershipWhere(profile.id, profile.phone),
    },
    select: {
      status: true,
      pickupDate: true,
      paymentStatus: true,
      paidAmountSar: true,
      balanceDueAtBranchSar: true,
      paymentGatewayRef: true,
    },
  });
  if (!bookingGate) {
    return { ok: false, error: "الحجز غير موجود أو لا يخص حسابك." };
  }
  const gateStatusKey = bookingGate.status.trim().toUpperCase();
  if (gateStatusKey === "CANCELLED" || gateStatusKey === "REJECTED") {
    return { ok: false, error: "لا يمكن إتمام الدفع لحجز ملغى أو مرفوض." };
  }
  if (hasBookingPickupPassed(bookingGate.pickupDate)) {
    return {
      ok: false,
      error: "بدأ موعد استلام هذا الحجز، لا يمكن إتمام الدفع من الحساب. يرجى التواصل مع الدعم.",
    };
  }

  const isCash = paymentMethod === "CASH";

  // وضع «دفع فرق التمديد»: الحجز مدفوع سابقاً وعليه رصيد بعد تعديل/تمديد —
  // يُسدَّد الرصيد فقط (لا يُعاد دفع الإجمالي)، ولا يُقبل الكاش هنا (الفرع يسجّله الموظف).
  const balanceDueSar =
    bookingGate.paymentStatus.trim().toUpperCase() === "PAID"
      ? Math.round((bookingGate.balanceDueAtBranchSar ?? 0) * 100) / 100
      : 0;
  const isBalancePayment = balanceDueSar > 0;
  if (isBalancePayment) {
    if (isCash) {
      return {
        ok: false,
        error: "فرق التمديد يُسدَّد أونلاين من هذه الصفحة، أو نقداً لدى موظف الفرع.",
      };
    }

    const geideaBalanceHosted =
      isGeideaConfigured() &&
      (paymentMethod === "CARD" ||
        paymentMethod === "MADA" ||
        paymentMethod === "APPLE_PAY");

    if (geideaBalanceHosted) {
      const appUrl = (process.env.APP_PUBLIC_URL ?? "").trim().replace(/\/$/, "");
      let redirectUrl: string;
      try {
        const session = await createGeideaCheckoutSession({
          bookingRequestId: id,
          amountSar: balanceDueSar,
          returnUrl: `${appUrl}/fleet/payment/${id}`,
          callbackUrl: `${appUrl}/api/payments/geidea/webhook`,
        });
        await prisma.bookingRequest.update({
          where: { id },
          data: { paymentSessionRef: session.merchantReferenceId },
        });
        redirectUrl = session.redirectUrl;
      } catch (e) {
        console.error("[geidea] balance session creation failed:", e);
        return { ok: false, error: "تعذّر فتح صفحة الدفع الآمنة. حاول مجدداً." };
      }
      redirect(redirectUrl);
    }

    // بلا بوابة (محاكاة/وسائل غير مربوطة): تُسجَّل دفعة الرصيد مباشرةً بقفل تفاؤلي.
    const res = await prisma.bookingRequest.updateMany({
      where: {
        id,
        paymentStatus: "PAID",
        balanceDueAtBranchSar: bookingGate.balanceDueAtBranchSar,
        ...customerBookingOwnershipWhere(profile.id, profile.phone),
      },
      data: {
        paidAmountSar: (bookingGate.paidAmountSar ?? 0) + balanceDueSar,
        balanceDueAtBranchSar: null,
      },
    });
    if (res.count === 0) {
      return {
        ok: false,
        error: "تعذّر تسجيل دفعة الفرق — تحدّثت حالة الحجز. حدّث الصفحة وحاول مجدداً.",
      };
    }
    await logActivity({
      kind: "BOOKING_PAYMENT",
      path: `/fleet/payment/${id}`,
      actorLabel: `العميل — دفعة فرق تمديد ${balanceDueSar} ر.س (${paymentMethod})`,
    });
    revalidatePath(`/fleet/payment/${id}`);
    revalidatePath("/account");
    revalidatePath("/admin");
    revalidatePath("/admin/car-bookings");
    return { ok: true, paymentMethod };
  }

  // إجمالي الحجز (شامل الضريبة) يُسجَّل في paidAmountSar عند الدفع الإلكتروني —
  // تعتمد عليه لوحة الإدارة في سقف الاسترداد واحتساب المتبقي.
  let paidTotalSar: number | null = null;
  if (!isCash) {
    const row = await prisma.bookingRequest.findFirst({
      where: {
        id,
        kind: "DIRECT",
        ...customerBookingOwnershipWhere(profile.id, profile.phone),
      },
      select: {
        snapshotTotalAmountSar: true,
        numberOfDays: true,
        addonsJson: true,
        carModel: { select: { price: true, vatRatePercent: true } },
      },
    });
    paidTotalSar =
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
        : null);
  }

  // بطاقة/مدى/Apple Pay مع مفاتيح جيديا: جلسة دفع مستضافة (HPP) — التأكيد الفعلي
  // يصل عبر الـ webhook، لا يُسجَّل أي دفع هنا.
  const geideaHosted =
    !isCash &&
    isGeideaConfigured() &&
    (paymentMethod === "CARD" ||
      paymentMethod === "MADA" ||
      paymentMethod === "APPLE_PAY");

  if (geideaHosted) {
    if (paidTotalSar == null || paidTotalSar <= 0) {
      return { ok: false, error: "تعذّر احتساب مبلغ الحجز. تواصل مع الدعم." };
    }
    const appUrl = (process.env.APP_PUBLIC_URL ?? "").trim().replace(/\/$/, "");
    let redirectUrl: string;
    try {
      const session = await createGeideaCheckoutSession({
        bookingRequestId: id,
        amountSar: paidTotalSar,
        returnUrl: `${appUrl}/fleet/payment/${id}`,
        callbackUrl: `${appUrl}/api/payments/geidea/webhook`,
      });
      // مرجع الجلسة ووسيلة الدفع يُحفظان قبل التحويل — المرجع تستخدمه صفحة
      // الدفع للمصالحة، والوسيلة يعتمد عليها منفّذ الاسترداد لاحقاً.
      await prisma.bookingRequest.update({
        where: { id },
        data: {
          paymentSessionRef: session.merchantReferenceId,
          paymentMethod,
        },
      });
      redirectUrl = session.redirectUrl;
    } catch (e) {
      console.error("[geidea] session creation failed:", e);
      return { ok: false, error: "تعذّر فتح صفحة الدفع الآمنة. حاول مجدداً." };
    }
    redirect(redirectUrl);
  }

  try {
    const updated = await prisma.bookingRequest.updateMany({
      where: {
        id,
        kind: "DIRECT",
        paymentStatus: "PENDING",
        // ownershipWhere يحمل مفتاح OR الخاص به — نجمع شرط الكاش عبر AND بدل
        // spread مباشر حتى لا يطغى أحد مفتاحَي OR على الآخر بنفس الاسم.
        AND: [
          customerBookingOwnershipWhere(profile.id, profile.phone),
          // يمنع إعادة معالجة اختيار كاش سابق فقط (متعامل معه صراحة أدناه) —
          // لا يمنع التحول لكاش بعد محاولة إلكترونية سابقة فشلت (paymentMethod
          // يبقى مسجَّلاً بوسيلة البطاقة رغم فشل الدفع طالما الحالة لا تزال PENDING).
          // ملاحظة: `not: "CASH"` وحدها تستبعد الصفوف بقيمة NULL في MySQL
          // (NULL <> 'CASH' = NULL وليس true) — لازم OR صريح مع null.
          isCash
            ? { OR: [{ paymentMethod: null }, { paymentMethod: { not: "CASH" } }] }
            : {},
        ],
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
            paidAmountSar: paidTotalSar,
            balanceDueAtBranchSar: null,
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
        await sendAdminEmailForNewBooking(id);
      } catch (e) {
        console.error("[sendAdminEmailForNewBooking] بعد تأكيد الدفع:", e);
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
