"use server";

import { revalidatePath } from "next/cache";
import {
  assertBookingRequestInScope,
  requireAdminForAction,
  requirePermissionForAction,
} from "@/lib/admin-access";
import {
  cancelBookingWithFullRefundByAdmin,
  cancelBookingWithoutRefundByAdmin,
  cancelBookingWithPolicy,
} from "@/lib/booking-cancellation-service";
import { logBookingEvent } from "@/lib/booking-audit";

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

  await logBookingEvent({
    bookingId: bookingRequestId,
    event: "BOOKING_CANCELLED",
    actorKind: "ADMIN",
    actorName: auth.session.displayName,
    toStatus: "CANCELLED",
    notes: result.refundInclTaxSar
      ? `استرداد ${result.refundInclTaxSar} ر.س — ${result.paymentMethod ?? ""}`
      : undefined,
  });

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
 *
 * صلاحية CANCEL_OVERRIDE مخصَّصة (لا FINANCIALS العامة) — تُمنح صراحةً من إدارة
 * الموظفين، ومدير النظام يمرّ دائماً عبر requirePermissionForAction.
 */
export async function cancelAdminBookingWithFullRefund(
  formData: FormData,
): Promise<AdminCancelWithFullRefundResult> {
  const auth = await requirePermissionForAction("CANCEL_OVERRIDE");
  if (!auth.ok) return { ok: false, error: auth.error };

  const bookingRequestId = Number(formData.get("bookingRequestId"));
  if (!Number.isInteger(bookingRequestId) || bookingRequestId < 1) {
    return { ok: false, error: "معرّف الطلب غير صالح." };
  }

  const reasonAr = String(formData.get("reasonAr") ?? "").trim();
  if (!reasonAr) {
    return { ok: false, error: "سبب الاسترداد إلزامي." };
  }

  const channelRaw = String(formData.get("refundChannel") ?? "ORIGINAL").trim().toUpperCase();
  if (channelRaw !== "ORIGINAL" && channelRaw !== "CASH") {
    return { ok: false, error: "قناة الاسترداد غير صالحة." };
  }

  const scope = await assertBookingRequestInScope(auth.session, bookingRequestId);
  if (!scope.ok) return { ok: false, error: scope.error };

  const result = await cancelBookingWithFullRefundByAdmin({
    bookingRequestId,
    reasonAr,
    actorLabel: auth.session.displayName,
    refundChannel: channelRaw,
  });

  if (!result.ok) return result;

  await logBookingEvent({
    bookingId: bookingRequestId,
    event: "BOOKING_CANCELLED",
    actorKind: "ADMIN",
    actorName: auth.session.displayName,
    toStatus: "CANCELLED",
    notes: `استرداد كامل: ${result.refundInclTaxSar} ر.س — ${reasonAr}`,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/car-bookings");
  revalidatePath(`/admin/bookings/${bookingRequestId}`);
  revalidatePath("/admin/customer-dues");
  revalidatePath("/admin/company-dues");
  revalidatePath("/account");
  revalidatePath(`/fleet/payment/${bookingRequestId}`);

  return result;
}

export type AdminCancelWithoutRefundResult =
  | { ok: true; paymentMethod: string | null }
  | { ok: false; error: string };

/**
 * إلغاء إداري بلا استرداد — يتجاوز سياسة الشرائح في الاتجاه المعاكس للاسترداد
 * الكامل: تُخصَم كل أيام الحجز ولا يُرَدّ أي مبلغ. لحالات استثنائية (مخالفة شروط،
 * عدم حضور). يتطلب سبباً إلزامياً يُسجَّل على الحجز وفي سجل النشاط — نفس بوابة
 * صلاحية الاسترداد الكامل لأن القرارين يتجاوزان السياسة الافتراضية بنفس الوزن.
 */
export async function cancelAdminBookingWithoutRefund(
  formData: FormData,
): Promise<AdminCancelWithoutRefundResult> {
  const auth = await requirePermissionForAction("CANCEL_OVERRIDE");
  if (!auth.ok) return { ok: false, error: auth.error };

  const bookingRequestId = Number(formData.get("bookingRequestId"));
  if (!Number.isInteger(bookingRequestId) || bookingRequestId < 1) {
    return { ok: false, error: "معرّف الطلب غير صالح." };
  }

  const reasonAr = String(formData.get("reasonAr") ?? "").trim();
  if (!reasonAr) {
    return { ok: false, error: "سبب الإلغاء بلا استرداد إلزامي." };
  }

  const scope = await assertBookingRequestInScope(auth.session, bookingRequestId);
  if (!scope.ok) return { ok: false, error: scope.error };

  const result = await cancelBookingWithoutRefundByAdmin({
    bookingRequestId,
    reasonAr,
    actorLabel: auth.session.displayName,
  });

  if (!result.ok) return result;

  await logBookingEvent({
    bookingId: bookingRequestId,
    event: "BOOKING_CANCELLED",
    actorKind: "ADMIN",
    actorName: auth.session.displayName,
    toStatus: "CANCELLED",
    notes: `إلغاء بلا استرداد — ${reasonAr}`,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/car-bookings");
  revalidatePath(`/admin/bookings/${bookingRequestId}`);
  revalidatePath("/admin/customer-dues");
  revalidatePath("/admin/company-dues");
  revalidatePath("/account");
  revalidatePath(`/fleet/payment/${bookingRequestId}`);

  return result;
}
