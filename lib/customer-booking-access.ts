import { notFound, redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { getCustomerProfile } from "@/lib/customer-auth";
import { prisma } from "@/lib/prisma";
import { VISIBLE_BOOKINGS_WHERE } from "@/lib/booking-visibility";

/** مسارات مسموح العودة إليها بعد تسجيل الدخول. */
export function safeCustomerReturnPath(next: string | null | undefined): string {
  const n = next?.trim();
  if (!n || !n.startsWith("/") || n.startsWith("//")) return "/account";
  if (n.startsWith("/admin")) return "/account";
  if (!n.startsWith("/fleet/") && !n.startsWith("/account")) return "/account";
  return n;
}

export function paymentPageLoginRedirect(bookingRequestId: number): string {
  return `/account/login?next=${encodeURIComponent(`/fleet/payment/${bookingRequestId}`)}`;
}

export function customerOwnsBooking(
  row: { customerId: number | null; phone: string },
  customerId: number,
  customerPhone: string | null,
): boolean {
  if (row.customerId === customerId) return true;
  if (customerPhone && row.phone === customerPhone) return true;
  return false;
}

export function customerBookingOwnershipWhere(
  customerId: number,
  customerPhone: string | null,
): Prisma.BookingRequestWhereInput {
  return {
    OR: [
      { customerId },
      ...(customerPhone ? [{ phone: customerPhone }] : []),
    ],
  };
}

export async function bookingBelongsToCustomer(
  bookingRequestId: number,
  customerId: number,
  customerPhone: string | null,
): Promise<boolean> {
  const row = await prisma.bookingRequest.findFirst({
    where: {
      id: bookingRequestId,
      kind: "DIRECT",
      // المؤرشف محجوب عن العميل تماماً: لا صفحة دفع ولا تعديل ولا إلغاء.
      ...VISIBLE_BOOKINGS_WHERE,
      ...customerBookingOwnershipWhere(customerId, customerPhone),
    },
    select: { id: true },
  });
  return row != null;
}

/** صفحة الدفع: يوجّه لتسجيل الدخول أو 404 إن لم يكن الحجز للعميل. */
export async function requireCustomerPaymentPageAccess(
  bookingRequestId: number,
): Promise<void> {
  const profile = await getCustomerProfile();
  if (!profile) {
    redirect(paymentPageLoginRedirect(bookingRequestId));
  }
  const allowed = await bookingBelongsToCustomer(
    bookingRequestId,
    profile.id,
    profile.phone,
  );
  if (!allowed) {
    notFound();
  }
}

export async function requireCustomerBookingActionAccess(
  bookingRequestId: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const profile = await getCustomerProfile();
  if (!profile) {
    return { ok: false, error: "يجب تسجيل الدخول لإتمام هذه العملية." };
  }
  const allowed = await bookingBelongsToCustomer(
    bookingRequestId,
    profile.id,
    profile.phone,
  );
  if (!allowed) {
    return { ok: false, error: "الطلب غير موجود أو لا يخص حسابك." };
  }
  return { ok: true };
}
