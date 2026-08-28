"use server";

import { revalidatePath } from "next/cache";
import { requirePermissionForAction, assertBookingRequestInScope } from "@/lib/admin-access";
import { sendNewBookingNotificationEmails } from "@/lib/booking-notification-email";
import { BOOKING_EVENTS } from "@/lib/booking-audit";
import { prisma } from "@/lib/prisma";

const PAGE_PATH = "/admin/booking-notification-drops";

/**
 * إرسال يدوي لإشعار الموظفين على حجز لم يُرسل له الإشعار بعد (عادة لأن العميل
 * سايب صفحة الدفع قبل ما يكتمل). يستخدم نفس دالة الإرسال التلقائي بالضبط، فالعلامة
 * في BookingLog (STAFF_BOOKING_EMAIL_SENT) تُكتب بنفس المنطق وتمنع الإرسال المزدوج
 * لو استقر الحجز واترسل تلقائياً بعدها.
 */
export async function sendDroppedBookingNotificationAction(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requirePermissionForAction(PAGE_PATH);
  if (!auth.ok) return { ok: false, error: auth.error };

  const bookingId = Number(formData.get("bookingId"));
  if (!Number.isInteger(bookingId) || bookingId < 1) {
    return { ok: false, error: "معرّف الطلب غير صالح." };
  }

  const scope = await assertBookingRequestInScope(auth.session, bookingId);
  if (!scope.ok) return { ok: false, error: scope.error };

  const already = await prisma.bookingLog.findFirst({
    where: { bookingId, event: BOOKING_EVENTS.STAFF_BOOKING_EMAIL_SENT },
    select: { id: true },
  });
  if (already) {
    revalidatePath(PAGE_PATH);
    return { ok: false, error: "تم إرسال الإشعار لهذا الحجز بالفعل." };
  }

  await sendNewBookingNotificationEmails(bookingId);

  // الدالة تبتلع أخطاءها ولا ترمي شيئاً — النتيجة الوحيدة الموثوقة هي فحص العلامة
  // في BookingLog بعد المحاولة لمعرفة هل الإرسال تم فعلاً.
  const sent = await prisma.bookingLog.findFirst({
    where: { bookingId, event: BOOKING_EVENTS.STAFF_BOOKING_EMAIL_SENT },
    select: { id: true },
  });

  revalidatePath(PAGE_PATH);

  if (!sent) {
    return {
      ok: false,
      error:
        "لم يُرسل الإشعار — على الأرجح العميل لم يختر وسيلة دفع بعد، أو لا يوجد موظفون مفعَّل لهم استلام إشعار هذا الفرع.",
    };
  }
  return { ok: true };
}
