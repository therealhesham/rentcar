"use server";

import { revalidatePath } from "next/cache";
import { assertBookingRequestInScope, requirePermissionForAction } from "@/lib/admin-access";
import { currentRequestMeta, logActivity } from "@/lib/activity-log";
import { logBookingEvent } from "@/lib/booking-audit";
import { resolveOrCreateUserForBlacklist } from "@/lib/customer-blacklist";
import { prisma } from "@/lib/prisma";

export type BlacklistActionState = { ok: boolean; error?: string; message?: string };

/** صلاحية صفحة العملاء — نفس من يدير العملاء يدير قائمتهم السوداء. */
const CUSTOMERS_PERMISSION = "/admin/customers";

const TERMINAL_BOOKING_STATUSES = ["CANCELLED", "REJECTED", "COMPLETED"];

function readReason(formData: FormData): string | null {
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 500);
  return reason || null;
}

async function applyBlacklist(opts: {
  userId: number;
  blacklisted: boolean;
  reason: string | null;
  actorName: string;
  source: string;
}): Promise<{ phone: string | null; activeBookings: number }> {
  const user = await prisma.user.update({
    where: { id: opts.userId },
    data: opts.blacklisted
      ? { isBlacklisted: true, blacklistedAt: new Date(), blacklistReason: opts.reason }
      : { isBlacklisted: false, blacklistedAt: null, blacklistReason: null },
    select: { id: true, phone: true, email: true },
  });

  const meta = await currentRequestMeta();
  await logActivity({
    kind: opts.blacklisted ? "CUSTOMER_BLACKLISTED" : "CUSTOMER_UNBLACKLISTED",
    userId: user.id,
    actorLabel: opts.actorName,
    detail: [opts.source, user.phone ?? user.email, opts.reason].filter(Boolean).join(" · "),
    ip: meta.ip,
    userAgent: meta.userAgent,
  });

  // الحجوزات القائمة لا تُمَسّ — فقط نُبلغ الموظف بعددها ليتصرّف فيها يدوياً.
  const activeBookings = await prisma.bookingRequest.count({
    where: {
      OR: [{ customerId: user.id }, ...(user.phone ? [{ phone: user.phone }] : [])],
      isHidden: false,
      status: { notIn: TERMINAL_BOOKING_STATUSES },
    },
  });

  revalidatePath("/admin/customers");
  return { phone: user.phone, activeBookings };
}

function activeBookingsNote(count: number): string {
  return count > 0
    ? ` تنبيه: للعميل ${count} حجز نشط — لم يُلغَ تلقائياً، راجعه يدوياً إن لزم.`
    : "";
}

/** حظر/إلغاء حظر من صفحة العملاء. */
export async function setCustomerBlacklist(
  _prev: BlacklistActionState | null,
  formData: FormData,
): Promise<BlacklistActionState> {
  const auth = await requirePermissionForAction(CUSTOMERS_PERMISSION);
  if (!auth.ok) return { ok: false, error: auth.error };

  const userId = Number(formData.get("userId"));
  if (!Number.isInteger(userId) || userId < 1) {
    return { ok: false, error: "معرّف العميل غير صالح." };
  }
  const blacklisted = String(formData.get("blacklisted") ?? "") === "1";

  const exists = await prisma.user.findUnique({ where: { id: userId }, select: { id: true } });
  if (!exists) return { ok: false, error: "العميل غير موجود." };

  const result = await applyBlacklist({
    userId,
    blacklisted,
    reason: blacklisted ? readReason(formData) : null,
    actorName: auth.session.displayName,
    source: "customers-page",
  });

  return {
    ok: true,
    message: blacklisted
      ? `تمت إضافة العميل للقائمة السوداء.${activeBookingsNote(result.activeBookings)}`
      : "تمت إزالة العميل من القائمة السوداء.",
  };
}

/**
 * حظر/إلغاء حظر صاحب حجز من صفحة الحجز. عميل بلا حساب يُنشأ له حساب بالجوال
 * ليُحمل عليه الحظر (انظر `resolveOrCreateUserForBlacklist`).
 */
export async function setBookingCustomerBlacklist(
  _prev: BlacklistActionState | null,
  formData: FormData,
): Promise<BlacklistActionState> {
  const auth = await requirePermissionForAction(CUSTOMERS_PERMISSION);
  if (!auth.ok) return { ok: false, error: auth.error };

  const bookingId = Number(formData.get("bookingId"));
  if (!Number.isInteger(bookingId) || bookingId < 1) {
    return { ok: false, error: "معرّف الحجز غير صالح." };
  }
  const scope = await assertBookingRequestInScope(auth.session, bookingId);
  if (!scope.ok) return { ok: false, error: scope.error };

  const booking = await prisma.bookingRequest.findUnique({
    where: { id: bookingId },
    select: { id: true, customerId: true, phone: true, fullName: true },
  });
  if (!booking) return { ok: false, error: "الحجز غير موجود." };

  const blacklisted = String(formData.get("blacklisted") ?? "") === "1";
  const reason = blacklisted ? readReason(formData) : null;

  const userId = await resolveOrCreateUserForBlacklist({
    customerId: booking.customerId,
    phone: booking.phone,
    fullName: booking.fullName,
  });

  // ربط الحجز بالحساب إن لم يكن مربوطاً — ليظهر الحظر على الحجز ومن صفحة العملاء.
  if (booking.customerId == null) {
    await prisma.bookingRequest.update({
      where: { id: booking.id },
      data: { customerId: userId },
    });
  }

  const result = await applyBlacklist({
    userId,
    blacklisted,
    reason,
    actorName: auth.session.displayName,
    source: `booking #${booking.id}`,
  });

  await logBookingEvent({
    bookingId: booking.id,
    event: blacklisted ? "CUSTOMER_BLACKLISTED" : "CUSTOMER_UNBLACKLISTED",
    actorKind: "ADMIN",
    actorName: auth.session.displayName,
    notes: reason ?? undefined,
  });

  revalidatePath(`/admin/bookings/${booking.id}`);
  return {
    ok: true,
    message: blacklisted
      ? `تمت إضافة العميل للقائمة السوداء — لن يتمكن من أي حجز جديد.${activeBookingsNote(result.activeBookings)}`
      : "تمت إزالة العميل من القائمة السوداء.",
  };
}
