"use server";

import { revalidatePath } from "next/cache";
import {
  assertBookingRequestInScope,
  requireAdminForAction,
  requirePermissionForAction,
} from "@/lib/admin-access";
import {
  cancelBookingWithFullRefundByAdmin,
  cancelBookingWithPolicy,
} from "@/lib/booking-cancellation-service";

export type AdminCancelBookingResult =
  | { ok: true; refundInclTaxSar?: number; paymentMethod?: string | null }
  | { ok: false; error: string };

/** إلغاء حجز من لوحة الإدارة بنفس سياسة العميل (الخصم والاسترداد). */
export async function cancelAdminBooking(
  formData: FormData,
): Promise<AdminCancelBookingResult> {
  const auth = await requireAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const bookingRequestId = Number(formData.get("bookingRequestId"));
  if (!Number.isInteger(bookingRequestId) || bookingRequestId < 1) {
    return { ok: false, error: "معرّف الطلب غير صالح." };
  }

  const scope = await assertBookingRequestInScope(auth.session, bookingRequestId);
  if (!scope.ok) return { ok: false, error: scope.error };

  const result = await cancelBookingWithPolicy({
    bookingRequestId,
    role: "admin",
  });

  if (!result.ok) return result;

  revalidatePath("/admin");
  revalidatePath("/admin/car-bookings");
  revalidatePath(`/admin/bookings/${bookingRequestId}`);
  revalidatePath("/account");
  revalidatePath(`/fleet/payment/${bookingRequestId}`);

  return {
    ok: true,
    refundInclTaxSar: result.refundInclTaxSar,
    paymentMethod: result.paymentMethod,
  };
}

export type AdminCancelWithFullRefundResult =
  | { ok: true; refundInclTaxSar: number; paymentMethod: string | null }
  | { ok: false; error: string };

/**
 * إلغاء إداري باسترداد كامل يتجاوز سياسة خصم الشرائح — لحالات استثنائية
 * (مثال: عدم توفر السيارة). يتطلب سبباً إلزامياً يُسجَّل على الحجز وفي سجل النشاط.
 */
export async function cancelAdminBookingWithFullRefund(
  formData: FormData,
): Promise<AdminCancelWithFullRefundResult> {
  const auth = await requirePermissionForAction("FINANCIALS");
  if (!auth.ok) return { ok: false, error: auth.error };

  const bookingRequestId = Number(formData.get("bookingRequestId"));
  if (!Number.isInteger(bookingRequestId) || bookingRequestId < 1) {
    return { ok: false, error: "معرّف الطلب غير صالح." };
  }

  const reasonAr = String(formData.get("reasonAr") ?? "").trim();
  if (!reasonAr) {
    return { ok: false, error: "سبب الاسترداد إلزامي." };
  }

  const scope = await assertBookingRequestInScope(auth.session, bookingRequestId);
  if (!scope.ok) return { ok: false, error: scope.error };

  const result = await cancelBookingWithFullRefundByAdmin({
    bookingRequestId,
    reasonAr,
    actorLabel: auth.session.displayName,
  });

  if (!result.ok) return result;

  revalidatePath("/admin");
  revalidatePath("/admin/car-bookings");
  revalidatePath(`/admin/bookings/${bookingRequestId}`);
  revalidatePath("/admin/customer-dues");
  revalidatePath("/admin/company-dues");
  revalidatePath("/account");
  revalidatePath(`/fleet/payment/${bookingRequestId}`);

  return result;
}
