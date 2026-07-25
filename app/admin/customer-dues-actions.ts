"use server";

import { revalidatePath } from "next/cache";
import {
  assertBookingRequestInScope,
  requirePermissionForAction,
} from "@/lib/admin-access";
import { currentRequestMeta, logActivity } from "@/lib/activity-log";
import { executeCancellationRefundByPaymentMethod } from "@/lib/booking-refund-executor";
import { prisma } from "@/lib/prisma";
import { recordPaymentTransaction } from "@/lib/payment-transaction";

export type SettleCustomerDueResult = { ok: boolean; error?: string };

/**
 * تسوية «مستحقات للعميل» (رصيد ناتج عن تعديل قلّص إجمالي حجز مدفوع):
 * - CASH: تسليم نقدي في الفرع، يُسجَّل بمرجع يدوي اختياري.
 * - ORIGINAL: استرداد إلكتروني عبر نفس وسيلة الدفع الأصلية (بوابة جيديا للبطاقات/مدى/Apple Pay).
 * مطالبة ذرّية (CAS) تمنع التسوية المزدوجة عند طلبات متزامنة.
 */
export async function settleCustomerDue(
  _prev: SettleCustomerDueResult | null,
  formData: FormData,
): Promise<SettleCustomerDueResult> {
  const auth = await requirePermissionForAction("FINANCIALS");
  if (!auth.ok) return { ok: false, error: auth.error };

  const bookingId = Number(formData.get("bookingId"));
  if (!Number.isInteger(bookingId) || bookingId < 1) {
    return { ok: false, error: "معرّف الطلب غير صالح." };
  }

  const scope = await assertBookingRequestInScope(auth.session, bookingId);
  if (!scope.ok) return { ok: false, error: scope.error };

  const settleMode = String(formData.get("settleMode") ?? "").trim().toUpperCase();
  if (settleMode !== "CASH" && settleMode !== "ORIGINAL") {
    return { ok: false, error: "اختر آلية التسوية: نقداً أو عبر نفس وسيلة الدفع." };
  }
  const manualRef = String(formData.get("manualRef") ?? "").trim();

  const booking = await prisma.bookingRequest.findUnique({
    where: { id: bookingId },
    select: {
      refundDueToCustomerSar: true,
      refundDueSettledAt: true,
      paymentMethod: true,
      paidAmountSar: true,
    },
  });
  if (!booking) return { ok: false, error: "الطلب غير موجود." };

  const amount = Math.round((booking.refundDueToCustomerSar ?? 0) * 100) / 100;
  if (amount <= 0 || booking.refundDueSettledAt != null) {
    return { ok: false, error: "لا توجد مستحقات قائمة لهذا الحجز." };
  }

  const settledMethod =
    settleMode === "CASH" ? "CASH" : (booking.paymentMethod ?? "UNKNOWN");

  // مطالبة ذرّية بالتسوية قبل تنفيذ الاسترداد — يمرّ طلب واحد فقط.
  const claim = await prisma.bookingRequest.updateMany({
    where: {
      id: bookingId,
      refundDueToCustomerSar: booking.refundDueToCustomerSar,
      refundDueSettledAt: null,
    },
    data: {
      refundDueSettledAt: new Date(),
      refundDueSettledMethod: settledMethod,
      refundDueSettledBy: auth.session.displayName,
    },
  });
  if (claim.count === 0) {
    return {
      ok: false,
      error: "تعذّرت التسوية — سُوِّيت المستحقات من عملية أخرى. حدّث الصفحة.",
    };
  }

  let externalRef: string;
  if (settleMode === "CASH") {
    externalRef = manualRef || `CASH-MANUAL-${bookingId}-${Date.now()}`;
  } else {
    const exec = await executeCancellationRefundByPaymentMethod({
      bookingRequestId: bookingId,
      paymentMethod: booking.paymentMethod,
      refundAmountInclTaxSar: amount,
    });
    if (!exec.ok) {
      // فشل الاسترداد الإلكتروني: تُعاد المستحقات قائمةً ويُبلغ الموظف صراحةً.
      await prisma.bookingRequest.update({
        where: { id: bookingId },
        data: {
          refundDueSettledAt: null,
          refundDueSettledMethod: null,
          refundDueSettledBy: null,
        },
      });
      return { ok: false, error: exec.error };
    }
    externalRef = exec.externalRef;
  }

  // المدفوع الفعلي ينخفض بقيمة المبلغ المُعاد — يحافظ على سقف الاسترداد لاحقاً.
  // سطر التسوية يُدرَج في الدفتر ذرّياً مع التحديث النهائي.
  await prisma.$transaction(async (tx) => {
    await tx.bookingRequest.update({
      where: { id: bookingId },
      data: {
        refundDueSettledRef: externalRef,
        paidAmountSar: Math.max(
          0,
          Math.round(((booking.paidAmountSar ?? 0) - amount) * 100) / 100,
        ),
      },
    });
    await recordPaymentTransaction(
      {
        bookingId,
        kind: "CUSTOMER_SETTLEMENT",
        amountSar: amount,
        method: settledMethod,
        actorKind: "ADMIN",
        actorName: auth.session.displayName,
        externalRef,
        notes: settleMode === "CASH" ? "تسوية نقدية بالفرع" : "استرداد إلكتروني",
      },
      tx,
    );
  });

  const meta = await currentRequestMeta();
  await logActivity({
    kind: "BOOKING_REFUND",
    path: `/admin/customer-dues`,
    actorLabel: `${auth.session.displayName} — تسوية مستحقات عميل ${amount} ر.س (${settledMethod}) للحجز #${bookingId}`,
    userId: auth.session.employeeId,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  revalidatePath("/admin/customer-dues");
  revalidatePath("/admin/financials");
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath("/account");

  return { ok: true };
}
