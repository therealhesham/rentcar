"use server";

import { revalidatePath } from "next/cache";
import {
  assertBookingRequestInScope,
  requirePermissionForAction,
} from "@/lib/admin-access";
import {
  applyAdminCoupon,
  previewAdminCouponApply,
  type AdminCouponPreviewResult,
} from "@/lib/booking-coupon-admin-apply";

export type AdminCouponApplyActionResult = {
  ok: boolean;
  error?: string;
  alreadyApplied?: boolean;
};

function revalidateBooking(bookingId: number) {
  revalidatePath("/admin");
  revalidatePath(`/admin/bookings/${bookingId}`);
  revalidatePath(`/admin/bookings/${bookingId}/finance`);
  revalidatePath(`/admin/bookings/${bookingId}/statement`);
}

/** معاينة كود خصم على حجز موجود قبل التأكيد — لا تُنشئ ولا تُلزم شيئاً. */
export async function previewAdminCouponAction(
  bookingRequestId: number,
  code: string,
): Promise<AdminCouponPreviewResult> {
  const auth = await requirePermissionForAction("BOOKING_EDIT");
  if (!auth.ok) return { ok: false, error: auth.error };

  if (!Number.isInteger(bookingRequestId) || bookingRequestId < 1) {
    return { ok: false, error: "معرّف الحجز غير صالح." };
  }
  const scope = await assertBookingRequestInScope(auth.session, bookingRequestId);
  if (!scope.ok) return { ok: false, error: scope.error };

  return previewAdminCouponApply(bookingRequestId, code);
}

/** تطبيق كود خصم فعلياً على حجز موجود — يُلزم الحجز ويسجّل استخدام الكود. */
export async function applyAdminCouponAction(
  _prev: AdminCouponApplyActionResult | null,
  formData: FormData,
): Promise<AdminCouponApplyActionResult> {
  const auth = await requirePermissionForAction("BOOKING_EDIT");
  if (!auth.ok) return { ok: false, error: auth.error };

  const bookingRequestId = Number(formData.get("bookingRequestId"));
  if (!Number.isInteger(bookingRequestId) || bookingRequestId < 1) {
    return { ok: false, error: "معرّف الحجز غير صالح." };
  }

  const scope = await assertBookingRequestInScope(auth.session, bookingRequestId);
  if (!scope.ok) return { ok: false, error: scope.error };

  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { ok: false, error: "أدخل كود الخصم." };

  const result = await applyAdminCoupon(bookingRequestId, code);
  if (!result.ok) return { ok: false, error: result.error };

  revalidateBooking(bookingRequestId);
  return { ok: true, alreadyApplied: result.alreadyApplied };
}
