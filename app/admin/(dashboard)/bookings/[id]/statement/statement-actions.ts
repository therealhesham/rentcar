"use server";

import { getAdminSession } from "@/lib/admin-auth";
import { resendBookingInvoiceEmail, type ResendBookingInvoiceResult } from "@/lib/booking-invoice-email";

export async function adminSendStatementEmail(bookingId: number): Promise<ResendBookingInvoiceResult> {
  const session = await getAdminSession();
  if (!session) {
    return { ok: false, error: "غير مصرح (Session Expired)" };
  }
  
  return resendBookingInvoiceEmail(bookingId);
}
