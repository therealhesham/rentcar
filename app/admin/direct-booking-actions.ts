"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { enforceBranchOnFormData, requireAdminForAction } from "@/lib/admin-access";
import { isCashPaymentMethod } from "@/lib/booking-cash-flow";
import { sendBookingInvoiceEmailAfterPayment } from "@/lib/booking-invoice-email";
import { sendBookingReceivedNotification } from "@/lib/booking-received-notification";
import { sendBookingCompletionWhatsAppAfterPayment } from "@/lib/evolution-whatsapp";
import { parseAdminOfficePaymentFromFormData } from "@/lib/booking-payment-methods";
import {
  createDirectBooking,
  parseCommonBookingFieldsFromFormData,
} from "@/lib/direct-booking";

export type AdminDirectBookingActionState = {
  ok: boolean;
  error?: string;
  bookingRequestId?: number;
};

export async function submitAdminDirectBooking(
  _prev: AdminDirectBookingActionState | null,
  formData: FormData,
): Promise<AdminDirectBookingActionState> {
  const auth = await requireAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const scopedForm = enforceBranchOnFormData(auth.session, formData);
  const carModelId = Number(scopedForm.get("carModelId"));
  if (!Number.isInteger(carModelId) || carModelId < 1) {
    return { ok: false, error: "اختر المركبة." };
  }

  const parsed = parseCommonBookingFieldsFromFormData(scopedForm);
  if (!parsed.ok) {
    return parsed;
  }

  const paymentParsed = parseAdminOfficePaymentFromFormData(scopedForm);
  if (!paymentParsed.ok) {
    return paymentParsed;
  }

  const customerIdRaw = scopedForm.get("customerId");
  const customerId = Number(customerIdRaw);
  const linkedCustomerId =
    Number.isInteger(customerId) && customerId > 0 ? customerId : null;

  const created = await createDirectBooking({
    carModelId,
    customerId: linkedCustomerId,
    officePayment: paymentParsed.recordNow
      ? { recordNow: true, method: paymentParsed.method }
      : { recordNow: false },
    ...parsed.data,
  });
  if (!created.ok) {
    return { ok: false, error: created.error };
  }

  if (paymentParsed.recordNow) {
    if (isCashPaymentMethod(paymentParsed.method)) {
      try {
        await sendBookingReceivedNotification(created.bookingRequestId);
      } catch (e) {
        console.error("[booking-received] بعد حجز المكتب (كاش):", e);
      }
    } else {
      try {
        await sendBookingInvoiceEmailAfterPayment(created.bookingRequestId);
      } catch (e) {
        console.error("[booking-invoice-email] بعد حجز المكتب:", e);
      }
      try {
        await sendBookingCompletionWhatsAppAfterPayment(created.bookingRequestId);
      } catch (e) {
        console.error("[evolution-whatsapp] بعد حجز المكتب:", e);
      }
    }
  }

  revalidatePath("/admin");
  revalidatePath("/admin/car-bookings");
  revalidatePath("/admin/customers");
  revalidatePath("/admin/fleet-availability");
  revalidatePath("/fleet");
  revalidatePath("/admin/direct-booking");
  revalidatePath(`/admin/bookings/${created.bookingRequestId}`);
  redirect(`/admin/bookings/${created.bookingRequestId}`);
}
