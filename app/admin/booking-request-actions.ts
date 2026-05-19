"use server";

import { revalidatePath } from "next/cache";
import {
  assertBookingRequestInScope,
  enforceBranchOnFormData,
  requireAdminForAction,
} from "@/lib/admin-access";
import {
  convertDirectBookingToInquiry,
  convertInquiryBookingToDirect,
  parseCommonBookingFieldsFromFormData,
  updateBookingRequestByAdmin,
} from "@/lib/direct-booking";

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

  revalidatePath("/admin");
  revalidatePath("/fleet");
  revalidatePath("/admin/car-bookings");
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

  revalidatePath("/admin");
  revalidatePath("/fleet");
  revalidatePath("/admin/car-bookings");
  return { ok: true };
}
