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
import { sendBookingCompletionWhatsAppAfterPayment } from "@/lib/evolution-whatsapp";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notification-service";

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

  if (statusUpper === "CONFIRMED" && wasNotConfirmed && cashDirect) {
    try {
      await sendBookingCompletionWhatsAppAfterPayment(bookingRequestId);
    } catch (e) {
      console.error("[evolution-whatsapp] بعد تأكيد الموظف (كاش):", e);
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
