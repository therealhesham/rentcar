"use server";

import { revalidatePath } from "next/cache";
import {
  assertBookingRequestInScope,
  assertBranchSlugInScope,
  enforceBranchOnFormData,
  requireAdminForAction,
  requirePermissionForAction,
} from "@/lib/admin-access";
import { type AdminSession } from "@/lib/admin-auth";
import { isCashPaymentMethod } from "@/lib/booking-cash-flow";

import {
  DROPOFF_AFTER_PICKUP_ERROR_AR,
  computeBookingDays,
  isDropoffAfterPickup,
} from "@/lib/booking-days";
import { syncLifecycleFromAdminStatusChange } from "@/lib/booking-lifecycle-service";
import {
  convertDirectBookingToInquiry,
  convertInquiryBookingToDirect,
  parseCommonBookingFieldsFromFormData,
  updateBookingRequestByAdmin,
} from "@/lib/direct-booking";
import { sendBookingCompletionWhatsAppAfterPayment, sendBookingConfirmedWhatsAppToCustomer } from "@/lib/evolution-whatsapp";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notification-service";
import { computeCheckoutTotals } from "@/lib/booking-checkout-pricing";
import { parseBookingPricingSnapshot, resolveBookingRentalPricePerDayExclTax } from "@/lib/booking-pricing-snapshot";
import { logBookingEvent } from "@/lib/booking-audit";
import { currentRequestMeta, logActivity } from "@/lib/activity-log";
import { recordPaymentTransaction } from "@/lib/payment-transaction";
import { appendAdminNote, deleteAdminNote } from "@/lib/booking-admin-notes";

async function resolveAdminEmail(session: AdminSession): Promise<string> {
  if (session.employeeId) {
    const emp = await prisma.adminEmployee.findUnique({
      where: { id: session.employeeId },
      select: { email: true },
    });
    if (emp?.email?.trim()) {
      return emp.email.trim();
    }
  }
  if (session.displayName?.includes("@")) {
    return session.displayName.trim();
  }
  if (process.env.ADMIN_EMAIL) {
    return process.env.ADMIN_EMAIL.trim();
  }
  return "admin@rentcar.com";
}




export async function convertInquiryToDirect(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const bookingRequestId = Number(formData.get("bookingRequestId"));
  const carModelId = Number(formData.get("carModelId"));

  if (!Number.isInteger(bookingRequestId) || bookingRequestId < 1) {
    return { ok: false, error: "معرّف الطلب غير صالح." };
  }
  if (!Number.isInteger(carModelId) || carModelId < 1) {
    return { ok: false, error: "اختر موديل السيارة." };
  }

  const scope = await assertBookingRequestInScope(auth.session, bookingRequestId);
  if (!scope.ok) return { ok: false, error: scope.error };

  const result = await convertInquiryBookingToDirect(bookingRequestId, carModelId);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  await logBookingEvent({
    bookingId: bookingRequestId,
    event: "CONVERTED_TO_DIRECT",
    actorKind: "ADMIN",
    actorName: auth.session.displayName,
  });

  const booking = await prisma.bookingRequest.findUnique({ where: { id: bookingRequestId } });
  if (booking) {
    await createNotification(
      { branchId: booking.branchId ?? null },
      "تحويل حجز",
      `تم تحويل طلب استفسار إلى حجز مباشر للعميل ${booking.fullName}`
    );
  }

  revalidatePath("/admin");
  revalidatePath("/fleet");
  revalidatePath("/admin/car-bookings");
  revalidatePath(`/admin/bookings/${bookingRequestId}`);
  // الصفحات الفرعية لا تُبطَّل تلقائياً مع الصفحة الأم — بدونها تبقى أرقام
  // المالية وكشف الحساب على النسخة المخزّنة قبل التعديل.
  revalidatePath(`/admin/bookings/${bookingRequestId}/finance`);
  revalidatePath(`/admin/bookings/${bookingRequestId}/statement`);
  return { ok: true };
}

export async function revertDirectToInquiry(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const bookingRequestId = Number(formData.get("bookingRequestId"));

  if (!Number.isInteger(bookingRequestId) || bookingRequestId < 1) {
    return { ok: false, error: "معرّف الطلب غير صالح." };
  }

  const scope = await assertBookingRequestInScope(auth.session, bookingRequestId);
  if (!scope.ok) return { ok: false, error: scope.error };

  const result = await convertDirectBookingToInquiry(bookingRequestId);
  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  await logBookingEvent({
    bookingId: bookingRequestId,
    event: "REVERTED_TO_INQUIRY",
    actorKind: "ADMIN",
    actorName: auth.session.displayName,
  });

  revalidatePath("/admin");
  revalidatePath("/fleet");
  revalidatePath("/admin/car-bookings");
  revalidatePath(`/admin/bookings/${bookingRequestId}`);
  // الصفحات الفرعية لا تُبطَّل تلقائياً مع الصفحة الأم — بدونها تبقى أرقام
  // المالية وكشف الحساب على النسخة المخزّنة قبل التعديل.
  revalidatePath(`/admin/bookings/${bookingRequestId}/finance`);
  revalidatePath(`/admin/bookings/${bookingRequestId}/statement`);
  return { ok: true };
}

export async function updateBookingRequest(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requirePermissionForAction("BOOKING_EDIT");
  if (!auth.ok) return { ok: false, error: auth.error };

  const bookingRequestId = Number(formData.get("bookingRequestId"));
  if (!Number.isInteger(bookingRequestId) || bookingRequestId < 1) {
    return { ok: false, error: "معرّف الطلب غير صالح." };
  }

  const scope = await assertBookingRequestInScope(auth.session, bookingRequestId);
  if (!scope.ok) return { ok: false, error: scope.error };

  const scopedForm = enforceBranchOnFormData(auth.session, formData);
  const branchScope = await assertBranchSlugInScope(
    auth.session,
    String(scopedForm.get("branch") ?? ""),
  );
  if (!branchScope.ok) return { ok: false, error: branchScope.error };

  const parsed = parseCommonBookingFieldsFromFormData(scopedForm);
  if (!parsed.ok) {
    return parsed;
  }

  // المودال يرسل لحظتَي الاستلام والتسليم، والمدة تُحتسب هنا من الفارق بينهما —
  // نفس حساب مسار العميل (computeBookingDays) ولا يُعتمد على رقم أيام من المتصفح.
  const dropoffRaw = String(scopedForm.get("dropoffDate") ?? "").trim();
  if (dropoffRaw) {
    const dropoffDate = new Date(dropoffRaw);
    if (Number.isNaN(dropoffDate.getTime())) {
      return { ok: false, error: "يرجى اختيار تاريخ ووقت التسليم." };
    }
    if (!isDropoffAfterPickup(parsed.data.pickupDate, dropoffDate)) {
      return { ok: false, error: DROPOFF_AFTER_PICKUP_ERROR_AR };
    }
    parsed.data.numberOfDays = computeBookingDays(parsed.data.pickupDate, dropoffDate);
    // ساعات ما بعد آخر يوم كامل تُسعَّر من هذا الوقت بالذات — مطابقةً لما يعرضه المودال.
    parsed.data.dropoffDate = dropoffDate;
  }

  const status = String(scopedForm.get("status") ?? "").trim();
  const statusUpper = status.toUpperCase();

  const beforeUpdate = await prisma.bookingRequest.findUnique({
    where: { id: bookingRequestId },
    select: {
      status: true,
      paymentMethod: true,
      kind: true,
      branchId: true,
      returnBranchId: true,
      adminNotes: true,
    },
  });

  const inquirySlug = String(scopedForm.get("inquiryCarType") ?? "").trim();
  const rawModel = scopedForm.get("carModelId");
  const directModelId =
    rawModel !== null && String(rawModel).trim() !== ""
      ? Number(rawModel)
      : NaN;

  if (statusUpper === "PICKED_UP" && parsed.data.pickupDate && new Date() < parsed.data.pickupDate) {
    return { ok: false, error: "لا يمكن تسليم السيارة للعميل قبل الموعد المحدد للحجز." };
  }

  const vehiclePlateNumberRaw = formData.get("vehiclePlateNumber");

  const vehiclePlateNumber = vehiclePlateNumberRaw !== null ? String(vehiclePlateNumberRaw).trim() : undefined;
  const newNoteText = String(formData.get("adminNotes") ?? "").trim();
  let adminNotesToSave: string | undefined = undefined;
  if (newNoteText) {
    const authorIdentifier = await resolveAdminEmail(auth.session);
    adminNotesToSave = appendAdminNote(beforeUpdate?.adminNotes, newNoteText, authorIdentifier);
  }



  const result = await updateBookingRequestByAdmin(bookingRequestId, {
    ...parsed.data,
    status,
    inquiryCarTypeSlug: inquirySlug || null,
    directCarModelId:
      Number.isInteger(directModelId) && directModelId > 0 ? directModelId : null,
    vehiclePlateNumber,
    adminNotes: adminNotesToSave,
  });



  if (!result.ok) {
    return { ok: false, error: result.error };
  }

  // أثر التعديل في سجل الحجز — بدونه يرى الموظف التواريخ الجديدة بلا أي بيان
  // لمن غيّرها ولا ما كانت عليه. مطابِق لما يُسجَّل عند تعديل العميل الذاتي.
  const [daysBefore, daysAfter] = result.changes?.numberOfDays ?? [0, 0];
  await logBookingEvent({
    bookingId: bookingRequestId,
    event: "BOOKING_UPDATED",
    actorKind: "ADMIN",
    actorName: auth.session.displayName,
    fromStatus: beforeUpdate?.status,
    toStatus: status,
    notes:
      daysBefore !== daysAfter ? `المدة: ${daysBefore} ← ${daysAfter} يوم` : undefined,
    meta: {
      numberOfDaysBefore: daysBefore,
      numberOfDaysAfter: daysAfter,
      snapshotTotalAmountSar: result.changes?.snapshotTotalAmountSar ?? null,
      ...(result.creditForCustomerSar ? { creditForCustomerSar: result.creditForCustomerSar } : {}),
    },
  });

  // مستحقات جديدة للعميل بعد التعديل — تنبيه الفرع وقسم «مستحقات للعميل».
  if (result.creditForCustomerSar && result.creditForCustomerSar > 0) {
    const amount = result.creditForCustomerSar;
    try {
      await createNotification(
        { branchId: beforeUpdate?.branchId ?? beforeUpdate?.returnBranchId ?? null },
        "مستحقات للعميل بعد تعديل حجز",
        `الحجز #${bookingRequestId} عُدِّل من الإدارة وأصبح للعميل مستحقات ${amount} ر.س — تُسوَّى من قسم «مستحقات للعميل».`,
      );
      const meta = await currentRequestMeta();
      await logActivity({
        kind: "BOOKING_REFUND",
        path: `/admin/customer-dues`,
        actorLabel: `${auth.session.displayName} — تعديل الحجز #${bookingRequestId} أنشأ مستحقات ${amount} ر.س`,
        ip: meta.ip,
        userAgent: meta.userAgent,
      });
    } catch (e) {
      console.error("[customer-dues] بعد تعديل الحجز من الإدارة:", e);
    }
  }

  const wasNotConfirmed =
    beforeUpdate?.status.trim().toUpperCase() !== "CONFIRMED";
  const cashDirect =
    beforeUpdate?.kind === "DIRECT" &&
    isCashPaymentMethod(beforeUpdate.paymentMethod);

  if (statusUpper === "CONFIRMED" && wasNotConfirmed) {
    if (cashDirect) {
      try {
        await sendBookingCompletionWhatsAppAfterPayment(bookingRequestId);
      } catch (e) {
        console.error("[evolution-whatsapp] بعد تأكيد الموظف (كاش):", e);
      }
    } else {
      try {
        await sendBookingConfirmedWhatsAppToCustomer(bookingRequestId);
      } catch (e) {
        console.error("[evolution-whatsapp] بعد تأكيد الموظف (تأكيد فقط):", e);
      }
    }
  }

  try {
    await syncLifecycleFromAdminStatusChange(
      bookingRequestId,
      beforeUpdate?.status ?? "",
      status,
      beforeUpdate?.paymentMethod ?? null,
    );
  } catch (e) {
    console.error("[booking-lifecycle] بعد تحديث الحالة:", e);
  }

  revalidatePath("/admin");
  revalidatePath("/fleet");
  revalidatePath("/account");
  revalidatePath("/admin/car-bookings");
  revalidatePath("/admin/customer-dues");
  revalidatePath(`/admin/bookings/${bookingRequestId}`);
  // الصفحات الفرعية لا تُبطَّل تلقائياً مع الصفحة الأم — بدونها تبقى أرقام
  // المالية وكشف الحساب على النسخة المخزّنة قبل التعديل.
  revalidatePath(`/admin/bookings/${bookingRequestId}/finance`);
  revalidatePath(`/admin/bookings/${bookingRequestId}/statement`);
  revalidatePath(`/fleet/payment/${bookingRequestId}`);
  return { ok: true };
}

export async function quickUpdateBookingStatus(
  bookingRequestId: number,
  newStatus: string
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!Number.isInteger(bookingRequestId) || bookingRequestId < 1) {
    return { ok: false, error: "معرّف الطلب غير صالح." };
  }

  const scope = await assertBookingRequestInScope(auth.session, bookingRequestId);
  if (!scope.ok) return { ok: false, error: scope.error };

  const beforeUpdate = await prisma.bookingRequest.findUnique({
    where: { id: bookingRequestId },
    select: { status: true, paymentMethod: true, kind: true, carModelId: true, pickupDate: true },
  });

  if (!beforeUpdate) return { ok: false, error: "الطلب غير موجود." };

  const statusUpper = newStatus.trim().toUpperCase();

  if (beforeUpdate.kind === "INQUIRY" && statusUpper === "CONFIRMED") {
    return { ok: false, error: "لا يمكن تأكيد طلب الاستفسار مباشرة. الرجاء فتح خيار (تعديل) واختيار السيارة أولاً." };
  }

  if (statusUpper === "CONFIRMED" && beforeUpdate.kind === "DIRECT" && !beforeUpdate.carModelId) {
    return { ok: false, error: "لا يمكن التأكيد لعدم وجود مركبة مرتبطة." };
  }

  if (statusUpper === "PICKED_UP" && new Date() < beforeUpdate.pickupDate) {
    return { ok: false, error: "لا يمكن تسليم السيارة للعميل قبل الموعد المحدد للحجز." };
  }

  await prisma.bookingRequest.update({
    where: { id: bookingRequestId },
    data: { status: statusUpper }
  });

  await logBookingEvent({
    bookingId: bookingRequestId,
    event: "STATUS_CHANGED",
    actorKind: "ADMIN",
    actorName: auth.session.displayName,
    fromStatus: beforeUpdate.status,
    toStatus: statusUpper,
  });

  const wasNotConfirmed = beforeUpdate.status.trim().toUpperCase() !== "CONFIRMED";
  const cashDirect = beforeUpdate.kind === "DIRECT" && isCashPaymentMethod(beforeUpdate.paymentMethod);

  if (statusUpper === "CONFIRMED" && wasNotConfirmed) {
    if (cashDirect) {
      try {
        await sendBookingCompletionWhatsAppAfterPayment(bookingRequestId);
      } catch (e) {
        console.error("[evolution-whatsapp] بعد تأكيد الموظف السريع (كاش):", e);
      }
    } else {
      try {
        await sendBookingConfirmedWhatsAppToCustomer(bookingRequestId);
      } catch (e) {
        console.error("[evolution-whatsapp] بعد تأكيد الموظف السريع (تأكيد فقط):", e);
      }
    }
  }

  try {
    await syncLifecycleFromAdminStatusChange(
      bookingRequestId,
      beforeUpdate.status,
      statusUpper,
      beforeUpdate.paymentMethod
    );
  } catch (e) {
    console.error("[booking-lifecycle] بعد التحديث السريع للحالة:", e);
  }

  revalidatePath("/admin");
  revalidatePath("/fleet");
  revalidatePath("/admin/car-bookings");
  revalidatePath(`/admin/bookings/${bookingRequestId}`);
  // الصفحات الفرعية لا تُبطَّل تلقائياً مع الصفحة الأم — بدونها تبقى أرقام
  // المالية وكشف الحساب على النسخة المخزّنة قبل التعديل.
  revalidatePath(`/admin/bookings/${bookingRequestId}/finance`);
  revalidatePath(`/admin/bookings/${bookingRequestId}/statement`);
  revalidatePath(`/fleet/payment/${bookingRequestId}`);
  return { ok: true };
}

export async function processAdminQuickPayment(
  bookingRequestId: number,
  paymentMethod: string
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!Number.isInteger(bookingRequestId) || bookingRequestId < 1) {
    return { ok: false, error: "معرّف الطلب غير صالح." };
  }

  const scope = await assertBookingRequestInScope(auth.session, bookingRequestId);
  if (!scope.ok) return { ok: false, error: scope.error };

  const beforeUpdate = await prisma.bookingRequest.findUnique({
    where: { id: bookingRequestId },
    select: {
      paymentStatus: true,
      status: true,
      kind: true,
      numberOfDays: true,
      addonsJson: true,
      carModel: { select: { price: true, vatRatePercent: true } },
    },
  });

  if (!beforeUpdate) return { ok: false, error: "الطلب غير موجود." };

  if (beforeUpdate.paymentStatus === "PAID") {
    return { ok: false, error: "الطلب مدفوع بالفعل." };
  }

  // حساب المبلغ الكامل شامل الضريبة
  let paidAmountSar: number | null = null;
  if (beforeUpdate.carModel) {
    const { addons, interCityShipping, checkoutOneTimeFees, delayPenalty, couponCode } = parseBookingPricingSnapshot(beforeUpdate.addonsJson);
    const effectivePrice = resolveBookingRentalPricePerDayExclTax(beforeUpdate.carModel.price, beforeUpdate.addonsJson);
    const shipFee = interCityShipping?.feeExclVatSar ?? 0;
    const feesSum = checkoutOneTimeFees.reduce((s, x) => s + x.feeExclVatSar, 0);
    // غرامة التأخير جزء من مستحقات العميل — إسقاطها هنا يسجّل مبلغاً أقل من الواجب.
    const delayFee = delayPenalty?.feeExclVatSar ?? 0;
    const discountExclTax = couponCode?.scope === "FULL_TOTAL" ? couponCode.discountExclTax : 0;
    const totals = computeCheckoutTotals(
      effectivePrice,
      beforeUpdate.numberOfDays,
      beforeUpdate.carModel.vatRatePercent,
      addons.map((a) => ({ pricePerDay: a.pricePerDayExclTax })),
      { oneTimeFeesExclTax: shipFee + feesSum + delayFee, discountExclTax },
    );
    paidAmountSar = totals.totalInclTax;
  }

  const { sendBookingInvoiceEmailAfterPayment } = await import("@/lib/booking-invoice-email");

  // تحديث الدفع + سطر INITIAL_PAYMENT في الدفتر ذرّياً.
  await prisma.$transaction(async (tx) => {
    await tx.bookingRequest.update({
      where: { id: bookingRequestId },
      data: {
        paymentStatus: "PAID",
        paymentMethod,
        paidAt: new Date(),
        balanceDueAtBranchSar: null,
        paidAmountSar,
      },
    });
    await recordPaymentTransaction(
      {
        bookingId: bookingRequestId,
        kind: "INITIAL_PAYMENT",
        amountSar: paidAmountSar ?? 0,
        method: paymentMethod,
        actorKind: "ADMIN",
        actorName: auth.session.displayName,
      },
      tx,
    );
  });

  try {
    await sendBookingInvoiceEmailAfterPayment(bookingRequestId);
  } catch (e) {
    console.error("[booking-invoice-email] بعد الدفع من الإدارة:", e);
  }

  try {
    const { sendNewBookingNotificationEmails } = await import(
      "@/lib/booking-notification-email"
    );
    await sendNewBookingNotificationEmails(bookingRequestId);
  } catch (e) {
    console.error("[booking-notification-email] بعد الدفع من الإدارة:", e);
  }

  try {
    const { sendAdminEmailForNewBooking } = await import("@/lib/booking-received-notification");
    await sendAdminEmailForNewBooking(bookingRequestId);
  } catch (e) {
    console.error("[sendAdminEmailForNewBooking] بعد الدفع من الإدارة:", e);
  }

  if (!isCashPaymentMethod(paymentMethod)) {
    try {
      await sendBookingCompletionWhatsAppAfterPayment(bookingRequestId);
    } catch (e) {
      console.error("[evolution-whatsapp] بعد الدفع من الإدارة:", e);
    }
  }

  await logBookingEvent({
    bookingId: bookingRequestId,
    event: "PAYMENT_RECORDED",
    actorKind: "ADMIN",
    actorName: auth.session.displayName,
    notes: `${paymentMethod} — ${paidAmountSar != null ? paidAmountSar + " ر.س" : ""}`.trim(),
  });

  revalidatePath("/admin");
  revalidatePath("/fleet");
  revalidatePath("/admin/car-bookings");
  revalidatePath(`/admin/bookings/${bookingRequestId}`);
  // الصفحات الفرعية لا تُبطَّل تلقائياً مع الصفحة الأم — بدونها تبقى أرقام
  // المالية وكشف الحساب على النسخة المخزّنة قبل التعديل.
  revalidatePath(`/admin/bookings/${bookingRequestId}/finance`);
  revalidatePath(`/admin/bookings/${bookingRequestId}/statement`);
  revalidatePath(`/fleet/payment/${bookingRequestId}`);
  return { ok: true };
}

export async function processAdminBalancePayment(
  bookingRequestId: number,
  paymentMethod: string
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!Number.isInteger(bookingRequestId) || bookingRequestId < 1) {
    return { ok: false, error: "معرّف الطلب غير صالح." };
  }

  const scope = await assertBookingRequestInScope(auth.session, bookingRequestId);
  if (!scope.ok) return { ok: false, error: scope.error };

  const booking = await prisma.bookingRequest.findUnique({
    where: { id: bookingRequestId },
    select: { paidAmountSar: true, balanceDueAtBranchSar: true, paymentStatus: true },
  });

  if (!booking) return { ok: false, error: "الطلب غير موجود." };
  if ((booking.balanceDueAtBranchSar ?? 0) <= 0) {
    return { ok: false, error: "لا يوجد مبالغ متبقية مستحقة لهذا الحجز." };
  }

  const newPaidAmount = (booking.paidAmountSar ?? 0) + (booking.balanceDueAtBranchSar ?? 0);
  const balancePaid = booking.balanceDueAtBranchSar ?? 0;

  // تحديث الرصيد + سطر BALANCE_PAYMENT في الدفتر ذرّياً.
  await prisma.$transaction(async (tx) => {
    await tx.bookingRequest.update({
      where: { id: bookingRequestId },
      data: {
        paidAmountSar: newPaidAmount,
        balanceDueAtBranchSar: 0,
        // Optional: we leave paymentStatus as PAID.
      },
    });
    await recordPaymentTransaction(
      {
        bookingId: bookingRequestId,
        kind: "BALANCE_PAYMENT",
        amountSar: balancePaid,
        method: paymentMethod,
        actorKind: "ADMIN",
        actorName: auth.session.displayName,
        notes: "سداد فرق تمديد بالفرع",
      },
      tx,
    );
  });

  await logBookingEvent({
    bookingId: bookingRequestId,
    event: "BALANCE_PAID",
    actorKind: "ADMIN",
    actorName: auth.session.displayName,
    notes: `${paymentMethod} — ${booking.balanceDueAtBranchSar} ر.س`,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/car-bookings");
  revalidatePath(`/admin/bookings/${bookingRequestId}`);
  // الصفحات الفرعية لا تُبطَّل تلقائياً مع الصفحة الأم — بدونها تبقى أرقام
  // المالية وكشف الحساب على النسخة المخزّنة قبل التعديل.
  revalidatePath(`/admin/bookings/${bookingRequestId}/statement`);
  revalidatePath(`/admin/bookings/${bookingRequestId}/finance`);
  return { ok: true };
}

export async function addBookingAdminNoteAction(
  bookingRequestId: number,
  noteText: string,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!Number.isInteger(bookingRequestId) || bookingRequestId < 1) {
    return { ok: false, error: "معرّف الطلب غير صالح." };
  }
  if (!noteText || !noteText.trim()) {
    return { ok: false, error: "يرجى كتابة نص الملاحظة." };
  }

  const scope = await assertBookingRequestInScope(auth.session, bookingRequestId);
  if (!scope.ok) return { ok: false, error: scope.error };

  try {
    const booking = await prisma.bookingRequest.findUnique({
      where: { id: bookingRequestId },
      select: { adminNotes: true },
    });
    if (!booking) return { ok: false, error: "الحجز غير موجود." };

    const authorIdentifier = await resolveAdminEmail(auth.session);
    const updatedNotesJson = appendAdminNote(booking.adminNotes, noteText, authorIdentifier);



    await prisma.bookingRequest.update({
      where: { id: bookingRequestId },
      data: { adminNotes: updatedNotesJson },
    });

    await logBookingEvent({
      bookingId: bookingRequestId,
      event: "ADMIN_NOTES_UPDATED",
      actorKind: "ADMIN",
      actorName: authorIdentifier,
      notes: `إضافة ملاحظة: ${noteText.trim().slice(0, 100)}`,
    });

    revalidatePath("/admin");
    revalidatePath("/admin/car-bookings");
    revalidatePath(`/admin/bookings/${bookingRequestId}`);
    return { ok: true };
  } catch (e) {
    console.error("addBookingAdminNoteAction error:", e);
    return { ok: false, error: "تعذّر إضافة الملاحظة." };
  }
}

export async function deleteBookingAdminNoteAction(
  bookingRequestId: number,
  noteId: string,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!Number.isInteger(bookingRequestId) || bookingRequestId < 1) {
    return { ok: false, error: "معرّف الطلب غير صالح." };
  }

  const scope = await assertBookingRequestInScope(auth.session, bookingRequestId);
  if (!scope.ok) return { ok: false, error: scope.error };

  try {
    const booking = await prisma.bookingRequest.findUnique({
      where: { id: bookingRequestId },
      select: { adminNotes: true },
    });
    if (!booking) return { ok: false, error: "الحجز غير موجود." };

    const updatedNotesJson = deleteAdminNote(booking.adminNotes, noteId);

    await prisma.bookingRequest.update({
      where: { id: bookingRequestId },
      data: { adminNotes: updatedNotesJson.trim() === "[]" ? null : updatedNotesJson },
    });

    await logBookingEvent({
      bookingId: bookingRequestId,
      event: "ADMIN_NOTES_UPDATED",
      actorKind: "ADMIN",
      actorName: auth.session.displayName,
      notes: "حذف ملاحظة إدارية",
    });

    revalidatePath("/admin");
    revalidatePath("/admin/car-bookings");
    revalidatePath(`/admin/bookings/${bookingRequestId}`);
    return { ok: true };
  } catch (e) {
    console.error("deleteBookingAdminNoteAction error:", e);
    return { ok: false, error: "تعذّر حذف الملاحظة." };
  }
}

