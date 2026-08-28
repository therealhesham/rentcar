"use server";

import { revalidatePath } from "next/cache";
import {
  assertBookingRequestInScope,
  requireAdminForAction,
  requirePermissionForAction,
} from "@/lib/admin-access";
import { currentRequestMeta, logActivity } from "@/lib/activity-log";
import { isBookingPaymentMethod } from "@/lib/booking-payment-methods";
import { executeCancellationRefundByPaymentMethod } from "@/lib/booking-refund-executor";
import { prisma } from "@/lib/prisma";
import { logBookingEvent } from "@/lib/booking-audit";
import { recordPaymentTransaction } from "@/lib/payment-transaction";
import { computeCheckoutTotals } from "@/lib/booking-checkout-pricing";
import {
  parseBookingPricingSnapshot,
  resolveBookingRentalPricePerDayExclTax,
} from "@/lib/booking-pricing-snapshot";

/** هامش تقريب للمقارنات المالية (كسور الهللة). */
const REFUND_EPS = 0.01;

const CONCURRENT_REFUND_ERROR =
  "تعذّر تنفيذ الاسترداد — تم تحديث حالة الطلب من عملية أخرى. حدّث الصفحة وحاول مجدداً.";

export async function processBookingRefund(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requirePermissionForAction("/admin/financials");
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
  // ONLINE = استرداد فعلي على نفس مرجع الدفع لدى البوابة؛ MANUAL = تسجيل فقط.
  const isOnline = String(formData.get("refundChannel") || "").trim().toUpperCase() === "ONLINE";

  const booking = await prisma.bookingRequest.findUnique({
    where: { id: bookingId },
    select: {
      paymentStatus: true,
      cancellationRefundAmountSar: true,
      paidAmountSar: true,
      paymentMethod: true,
      paymentGatewayRef: true,
      balanceDueAtBranchSar: true,
      cancellationRefundExternalRef: true,
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
  // سطر الاسترداد يُدرَج في الدفتر ذرّياً مع التحديث.
  // مرجع الموظف اليدوي أولاً؛ وإلا مرجع داخلي متتبّع (لا نستخدم بادئة MOCK لعملية حقيقية).
  let refundRef = externalRef || `OFFICE-REFUND-${bookingId}-${Date.now()}`;

  // الاسترداد الكامل يُلغي المعاملة: يُصفّى أي رصيد فرعي معلّق حتى لا يظهر الحجز
  // المسترَدّ كمستحق للشركة. الاسترداد الجزئي يُبقي الرصيد (قد يبقى مديناً).
  const claimData = {
    paymentStatus: fullyRefunded ? "REFUNDED" : "PARTIAL_REFUND",
    cancellationRefundAmountSar: newRefundTotal,
    ...(fullyRefunded ? { balanceDueAtBranchSar: null } : {}),
  };
  const claimWhere = {
    id: bookingId,
    paymentStatus: { not: "REFUNDED" },
    cancellationRefundAmountSar: booking.cancellationRefundAmountSar,
  };

  if (isOnline) {
    if (!booking.paymentGatewayRef?.trim()) {
      return {
        ok: false,
        error: "لا يوجد مرجع دفع لدى البوابة لهذا الحجز — استخدم التسجيل اليدوي.",
      };
    }

    // تُحجَز الحالة (compare-and-swap) قبل تحريك أي مال: نقرتان متزامنتان لا تنتجان
    // استردادين لدى البوابة. يُتراجع عن الحجز كاملاً إن رفضت البوابة.
    const claimed = await prisma.bookingRequest.updateMany({
      where: claimWhere,
      data: { ...claimData, cancellationRefundExternalRef: `PENDING-ONLINE-${bookingId}-${Date.now()}` },
    });
    if (claimed.count === 0) return { ok: false, error: CONCURRENT_REFUND_ERROR };

    const exec = await executeCancellationRefundByPaymentMethod({
      bookingRequestId: bookingId,
      paymentMethod: booking.paymentMethod,
      refundAmountInclTaxSar: amount,
    });

    if (!exec.ok) {
      // البوابة رفضت: تُعاد الحالة كما كانت بالضبط — لا سطر في الدفتر ولا مال تحرّك.
      await prisma.bookingRequest.update({
        where: { id: bookingId },
        data: {
          paymentStatus: booking.paymentStatus,
          cancellationRefundAmountSar: booking.cancellationRefundAmountSar,
          cancellationRefundExternalRef: booking.cancellationRefundExternalRef,
          ...(fullyRefunded ? { balanceDueAtBranchSar: booking.balanceDueAtBranchSar } : {}),
        },
      });
      return { ok: false, error: exec.error };
    }

    refundRef = exec.externalRef;
    await prisma.$transaction(async (tx) => {
      await tx.bookingRequest.update({
        where: { id: bookingId },
        data: { cancellationRefundExternalRef: refundRef },
      });
      await recordPaymentTransaction(
        {
          bookingId,
          kind: "REFUND",
          amountSar: amount,
          actorKind: "ADMIN",
          actorName: auth.session.displayName,
          externalRef: refundRef,
          notes: `${fullyRefunded ? "استرداد كامل" : "استرداد جزئي"} — عبر البوابة`,
        },
        tx,
      );
    });
  } else {
    const applied = await prisma.$transaction(async (tx) => {
      const res = await tx.bookingRequest.updateMany({
        where: claimWhere,
        data: { ...claimData, cancellationRefundExternalRef: refundRef },
      });
      if (res.count === 0) return false;
      await recordPaymentTransaction(
        {
          bookingId,
          kind: "REFUND",
          amountSar: amount,
          actorKind: "ADMIN",
          actorName: auth.session.displayName,
          externalRef: refundRef,
          notes: fullyRefunded ? "استرداد كامل" : "استرداد جزئي",
        },
        tx,
      );
      return true;
    });

    if (!applied) return { ok: false, error: CONCURRENT_REFUND_ERROR };
  }

  const meta = await currentRequestMeta();
  await logActivity({
    kind: "BOOKING_REFUND",
    path: `/admin/bookings/${bookingId}/finance`,
    actorLabel: `${auth.session.displayName} — استرداد ${amount} ر.س${isOnline ? " عبر البوابة" : " (تسجيل يدوي)"}`,
    userId: auth.session.employeeId,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  await logBookingEvent({
    bookingId,
    event: "REFUND_PROCESSED",
    actorKind: "ADMIN",
    actorName: auth.session.displayName,
    notes: `${amount} ر.س${isOnline ? " (عبر البوابة)" : ""} — مرجع: ${refundRef}`,
  });

  revalidatePath("/admin/financials");
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath(`/admin/bookings/${bookingId}/finance`);

  return { ok: true };
}

/**
 * عكس/تصحيح استرداد خاطئ: يُنقص المبلغ المسترد المسجّل ويعيد حالة الدفع
 * (PAID عند العكس الكامل، وإلا PARTIAL_REFUND)، ويدوّن سطر REFUND_REVERSAL في الدفتر.
 * يصحّح سجل النظام لاسترداد سُجِّل بالخطأ — لا يعيد تحصيل بطاقة العميل.
 */
export async function reverseBookingRefund(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requirePermissionForAction("/admin/financials");
  if (!auth.ok) return { ok: false, error: auth.error };

  const bookingId = Number(formData.get("bookingId"));
  if (!Number.isInteger(bookingId) || bookingId < 1) {
    return { ok: false, error: "معرّف الطلب غير صالح." };
  }

  const scope = await assertBookingRequestInScope(auth.session, bookingId);
  if (!scope.ok) return { ok: false, error: scope.error };

  const booking = await prisma.bookingRequest.findUnique({
    where: { id: bookingId },
    select: { cancellationRefundAmountSar: true },
  });
  if (!booking) return { ok: false, error: "الطلب غير موجود." };

  const currentRefund = booking.cancellationRefundAmountSar ?? 0;
  if (currentRefund <= 0) {
    return { ok: false, error: "لا يوجد استرداد مسجّل لعكسه." };
  }

  // مبلغ العكس: محدَّد من الفورم، أو كامل المسترد المسجّل افتراضياً.
  const amountRaw = String(formData.get("amount") ?? "").trim();
  const amount = amountRaw ? Number(amountRaw) : currentRefund;
  if (isNaN(amount) || amount <= 0) {
    return { ok: false, error: "مبلغ العكس غير صالح." };
  }
  if (amount > currentRefund + REFUND_EPS) {
    return {
      ok: false,
      error: `مبلغ العكس يتجاوز الاسترداد المسجّل (${currentRefund} ر.س).`,
    };
  }

  const newRefundTotal = Math.max(0, Math.round((currentRefund - amount) * 100) / 100);
  const backToPaid = newRefundTotal <= REFUND_EPS;

  // قفل تفاؤلي: يمرّ طلب واحد؛ سطر العكس يُدرَج ذرّياً مع تصحيح الحالة.
  const applied = await prisma.$transaction(async (tx) => {
    const res = await tx.bookingRequest.updateMany({
      where: {
        id: bookingId,
        cancellationRefundAmountSar: booking.cancellationRefundAmountSar,
      },
      data: {
        cancellationRefundAmountSar: backToPaid ? null : newRefundTotal,
        paymentStatus: backToPaid ? "PAID" : "PARTIAL_REFUND",
        ...(backToPaid ? { cancellationRefundExternalRef: null } : {}),
      },
    });
    if (res.count === 0) return false;
    await recordPaymentTransaction(
      {
        bookingId,
        kind: "REFUND_REVERSAL",
        direction: "CREDIT",
        amountSar: amount,
        actorKind: "ADMIN",
        actorName: auth.session.displayName,
        notes: "عكس/تصحيح استرداد خاطئ",
      },
      tx,
    );
    return true;
  });

  if (!applied) {
    return {
      ok: false,
      error: "تعذّر عكس الاسترداد — تم تحديث الطلب من عملية أخرى. حدّث الصفحة وحاول مجدداً.",
    };
  }

  const meta = await currentRequestMeta();
  await logActivity({
    kind: "BOOKING_REFUND",
    path: `/admin/bookings/${bookingId}/finance`,
    actorLabel: `${auth.session.displayName} — عكس استرداد ${amount} ر.س`,
    userId: auth.session.employeeId,
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  await logBookingEvent({
    bookingId,
    event: "REFUND_PROCESSED",
    actorKind: "ADMIN",
    actorName: auth.session.displayName,
    notes: `عكس استرداد ${amount} ر.س`,
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

  // المرجع واسم المستلِم يُولَّدان تلقائياً — لا يُدخلهما الموظف يدوياً.
  const externalRef = `OFFICE-${rawMethod}-${bookingId}-${Date.now()}`;
  const receivedBy = auth.session.displayName;

  const booking = await prisma.bookingRequest.findUnique({
    where: { id: bookingId },
    select: {
      paymentStatus: true,
      kind: true,
      balanceDueAtBranchSar: true,
      paidAmountSar: true,
      snapshotTotalAmountSar: true,
      addonsJson: true,
      numberOfDays: true,
      carModel: { select: { price: true, vatRatePercent: true } },
    },
  });

  if (!booking) return { ok: false, error: "الطلب غير موجود." };
  if (booking.kind !== "DIRECT") {
    return { ok: false, error: "تسجيل الدفع متاح للحجوزات المباشرة فقط." };
  }

  let totalAmountSar = booking.snapshotTotalAmountSar ?? 0;
  if (!totalAmountSar || totalAmountSar <= 0) {
    const { addons, interCityShipping, checkoutOneTimeFees, delayPenalty, couponCode } =
      parseBookingPricingSnapshot(booking.addonsJson);
    const effectiveRentalPrice = booking.carModel
      ? resolveBookingRentalPricePerDayExclTax(booking.carModel.price, booking.addonsJson)
      : 0;
    const oneTimeFeesExclTax =
      (interCityShipping?.feeExclVatSar ?? 0) +
      checkoutOneTimeFees.reduce((s, x) => s + x.feeExclVatSar, 0) +
      (delayPenalty?.feeExclVatSar ?? 0);
    const discountExclTax = couponCode?.scope === "FULL_TOTAL" ? couponCode.discountExclTax : 0;
    const vatRate = booking.carModel?.vatRatePercent ?? 15;
    const totals = computeCheckoutTotals(
      effectiveRentalPrice,
      booking.numberOfDays,
      vatRate,
      addons.map((a) => ({ pricePerDay: a.pricePerDayExclTax })),
      { oneTimeFeesExclTax, discountExclTax },
    );
    totalAmountSar = totals.totalInclTax;
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
    // لمنع تسجيل الدفعة مرتين عند الطلبات المتزامنة. سطر الدفعة يُدرَج ذرّياً.
    const applied = await prisma.$transaction(async (tx) => {
      const res = await tx.bookingRequest.updateMany({
        where: {
          id: bookingId,
          paymentStatus: "PAID",
          balanceDueAtBranchSar: booking.balanceDueAtBranchSar,
        },
        data: {
          paidAmountSar: newPaidAmount,
          balanceDueAtBranchSar: newBalance,
          // لا نُغيّر paymentMethod — وسيلة دفعة الرصيد قد تختلف عن الدفعة الأصلية.
          ...(externalRef ? { paymentExternalRef: externalRef } : {}),
          ...(receivedBy ? { paymentReceivedBy: receivedBy } : {}),
        },
      });
      if (res.count === 0) return false;
      await recordPaymentTransaction(
        {
          bookingId,
          kind: "BALANCE_PAYMENT",
          amountSar: amount,
          method: rawMethod,
          actorKind: "ADMIN",
          actorName: receivedBy,
          externalRef,
          notes: "سداد فرق تمديد أو دفعة متبقية بالفرع",
        },
        tx,
      );
      return true;
    });
    if (!applied) {
      return {
        ok: false,
        error: "تعذّر تسجيل الدفعة — تم تحديث الطلب من عملية أخرى. حدّث الصفحة وحاول مجدداً.",
      };
    }
  } else {
    // المستحق قبل الدفعة = إجمالي الإيجار + ما تراكم على الحجز (رسوم إضافية سُجّلت قبل التحصيل).
    // بدون ضمّ الرصيد القائم كانت الدفعة الأولى تكتب فوقه فتُمحى تلك الرسوم.
    const dueBeforePayment = totalAmountSar + (booking.balanceDueAtBranchSar ?? 0);
    const initialBalanceDue = Math.max(
      0,
      Math.round((dueBeforePayment - amount) * 100) / 100,
    );

    // قفل تفاؤلي: طلب واحد فقط يسجّل الدفعة الأولى. سطر الدفعة يُدرَج ذرّياً.
    const applied = await prisma.$transaction(async (tx) => {
      const res = await tx.bookingRequest.updateMany({
        // نقفل على الرصيد أيضاً: بند رسوم أُضيف بالتوازي يُبطل الدفعة بدل أن يُمحى.
        where: {
          id: bookingId,
          paymentStatus: { not: "PAID" },
          balanceDueAtBranchSar: booking.balanceDueAtBranchSar,
        },
        data: {
          paymentStatus:    "PAID",
          paidAmountSar:    amount,
          paymentMethod:    rawMethod,
          paidAt:           new Date(),
          ...(externalRef ? { paymentExternalRef: externalRef } : {}),
          ...(receivedBy  ? { paymentReceivedBy: receivedBy }             : {}),
          balanceDueAtBranchSar: initialBalanceDue,
        },
      });
      if (res.count === 0) return false;
      await recordPaymentTransaction(
        {
          bookingId,
          kind: "INITIAL_PAYMENT",
          amountSar: amount,
          method: rawMethod,
          actorKind: "ADMIN",
          actorName: receivedBy,
          externalRef,
        },
        tx,
      );
      return true;
    });
    if (!applied) {
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

  await logBookingEvent({
    bookingId,
    event: "PAYMENT_CONFIRMED",
    actorKind: "ADMIN",
    actorName: auth.session.displayName,
    notes: `${rawMethod} — ${amount} ر.س`,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/car-bookings");
  revalidatePath("/admin/company-dues");
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath(`/admin/bookings/${bookingId}/finance`);
  revalidatePath(`/admin/bookings/${bookingId}/statement`);

  return { ok: true };
}
