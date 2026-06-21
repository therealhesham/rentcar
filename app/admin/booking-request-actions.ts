"use server";

import { revalidatePath } from "next/cache";
import {
  assertBookingRequestInScope,
  enforceBranchOnFormData,
  requireAdminForAction,
} from "@/lib/admin-access";
import { isCashPaymentMethod } from "@/lib/booking-cash-flow";
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

  revalidatePath("/admin");
  revalidatePath("/fleet");
  revalidatePath("/admin/car-bookings");
  revalidatePath(`/admin/bookings/${bookingRequestId}`);
  return { ok: true };
}

export async function updateBookingRequest(
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

  const scopedForm = enforceBranchOnFormData(auth.session, formData);
  const parsed = parseCommonBookingFieldsFromFormData(scopedForm);
  if (!parsed.ok) {
    return parsed;
  }

  const status = String(scopedForm.get("status") ?? "").trim();
  const statusUpper = status.toUpperCase();

  const beforeUpdate = await prisma.bookingRequest.findUnique({
    where: { id: bookingRequestId },
    select: { status: true, paymentMethod: true, kind: true },
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

  const result = await updateBookingRequestByAdmin(bookingRequestId, {
    ...parsed.data,
    status,
    inquiryCarTypeSlug: inquirySlug || null,
    directCarModelId:
      Number.isInteger(directModelId) && directModelId > 0 ? directModelId : null,
  });

  if (!result.ok) {
    return { ok: false, error: result.error };
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
  revalidatePath("/admin/car-bookings");
  revalidatePath(`/admin/bookings/${bookingRequestId}`);
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
    const { addons, interCityShipping, checkoutOneTimeFees } = parseBookingPricingSnapshot(beforeUpdate.addonsJson);
    const effectivePrice = resolveBookingRentalPricePerDayExclTax(beforeUpdate.carModel.price, beforeUpdate.addonsJson);
    const shipFee = interCityShipping?.feeExclVatSar ?? 0;
    const feesSum = checkoutOneTimeFees.reduce((s, x) => s + x.feeExclVatSar, 0);
    const totals = computeCheckoutTotals(
      effectivePrice,
      beforeUpdate.numberOfDays,
      beforeUpdate.carModel.vatRatePercent,
      addons.map((a) => ({ pricePerDay: a.pricePerDayExclTax })),
      { oneTimeFeesExclTax: shipFee + feesSum },
    );
    paidAmountSar = totals.totalInclTax;
  }

  const { sendBookingInvoiceEmailAfterPayment } = await import("@/lib/booking-invoice-email");

  await prisma.bookingRequest.update({
    where: { id: bookingRequestId },
    data: {
      paymentStatus: "PAID",
      paymentMethod,
      paidAt: new Date(),
      balanceDueAtBranchSar: null,
      paidAmountSar,
    },
  });

  try {
    await sendBookingInvoiceEmailAfterPayment(bookingRequestId);
  } catch (e) {
    console.error("[booking-invoice-email] بعد الدفع من الإدارة:", e);
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

  revalidatePath("/admin");
  revalidatePath("/fleet");
  revalidatePath("/admin/car-bookings");
  revalidatePath(`/admin/bookings/${bookingRequestId}`);
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

  await prisma.bookingRequest.update({
    where: { id: bookingRequestId },
    data: {
      paidAmountSar: newPaidAmount,
      balanceDueAtBranchSar: 0,
      // Optional: we leave paymentStatus as PAID. 
    },
  });

  revalidatePath("/admin");
  revalidatePath("/admin/car-bookings");
  revalidatePath(`/admin/bookings/${bookingRequestId}`);
  revalidatePath(`/admin/bookings/${bookingRequestId}/finance`);
  return { ok: true };
}

