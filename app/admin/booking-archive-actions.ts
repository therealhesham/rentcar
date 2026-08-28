"use server";

import { revalidatePath } from "next/cache";
import { requireAdminForAction } from "@/lib/admin-access";
import { logBookingEvent } from "@/lib/booking-audit";
import { prisma } from "@/lib/prisma";

/**
 * أرشفة حجز أو إرجاعه (`BookingRequest.isHidden`).
 *
 * الأرشفة إخفاء لا حذف: الحجز يختفي عن العميل وعن اللوحة وعن كل الأقسام المالية،
 * لكن صفّه وسجله ودفتر حركاته تبقى كما هي ويمكن إرجاعه في أي وقت.
 *
 * مقصورة على مدير النظام: إخفاء حجز يغيّر المجاميع المالية، فليست صلاحية تُمنح.
 */
export async function setBookingArchived(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };
  if (!auth.session.isSuperAdmin) {
    return { ok: false, error: "الأرشفة متاحة لمدير النظام وحده." };
  }

  const bookingId = Number(formData.get("bookingId"));
  if (!Number.isInteger(bookingId) || bookingId < 1) {
    return { ok: false, error: "معرّف الطلب غير صالح." };
  }

  const archived = String(formData.get("archived") ?? "").trim() === "true";

  const booking = await prisma.bookingRequest.findUnique({
    where: { id: bookingId },
    select: { isHidden: true },
  });
  if (!booking) return { ok: false, error: "الطلب غير موجود." };
  if (booking.isHidden === archived) {
    return { ok: true };
  }

  await prisma.bookingRequest.update({
    where: { id: bookingId },
    data: { isHidden: archived },
  });

  await logBookingEvent({
    bookingId,
    event: "BOOKING_UPDATED",
    actorKind: "ADMIN",
    actorName: auth.session.displayName,
    notes: archived
      ? "أُرشِف الحجز — مخفي عن العميل وعن الأقسام المالية"
      : "أُعيد الحجز من الأرشيف",
  });

  // الأرشفة تغيّر المجاميع في كل قسم مالي، فتُبطَل ذاكرتها جميعاً.
  revalidatePath("/admin");
  revalidatePath("/admin/financials");
  revalidatePath("/admin/ledger");
  revalidatePath("/admin/company-dues");
  revalidatePath("/admin/customer-dues");
  revalidatePath("/admin/statistics");
  revalidatePath(`/admin/bookings/${bookingId}`);

  return { ok: true };
}
