import type { CreateDirectBookingInput } from "@/lib/direct-booking";
import { createDirectBooking, enforceEditLockedIdentityOnInput } from "@/lib/direct-booking";
import { setCustomerSessionCookie } from "@/lib/customer-auth";
import { upsertCustomerFromFleetBooking } from "@/lib/customer-upsert-from-checkout";

/**
 * إنشاء الحجز مع ربطه بحساب العميل (إنشاء/تحديث من بيانات الإتمام) وتسجيل دخول الجلسة.
 */
export async function createFleetBookingAndLinkCustomerSession(
  input: CreateDirectBookingInput,
): Promise<{ ok: true; bookingRequestId: number } | { ok: false; error: string }> {
  const email = (input.contactEmail ?? "").trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "البريد الإلكتروني غير صالح لربط الحساب." };
  }

  const enforced = await enforceEditLockedIdentityOnInput(input);
  if (!enforced.ok) return enforced;

  const cust = await upsertCustomerFromFleetBooking({
    email,
    phoneE164: enforced.prepared.phone.trim(),
    name: enforced.prepared.fullName.trim(),
  });
  if (!cust.ok) return cust;

  const created = await createDirectBooking({
    ...enforced.prepared,
    customerId: cust.userId,
  });
  if (!created.ok) return created;

  await setCustomerSessionCookie(cust.userId);
  return { ok: true, bookingRequestId: created.bookingRequestId };
}
