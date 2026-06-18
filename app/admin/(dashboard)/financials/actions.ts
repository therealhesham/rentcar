"use server";

import { requireAdminForAction } from "@/lib/admin-access";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { sendBookingCompletionWhatsAppAfterPayment } from "@/lib/evolution-whatsapp";

export async function markBookingAsPaid(_prev: any, formData: FormData) {
  const auth = await requireAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const bookingId = Number(formData.get("bookingId"));
  const method = String(formData.get("paymentMethod") || "CASH");

  if (bookingId > 0) {
    try {
      const beforeUpdate = await prisma.bookingRequest.findUnique({
        where: { id: bookingId },
        select: { status: true, kind: true },
      });

      await prisma.bookingRequest.update({
        where: { id: bookingId },
        data: {
          paymentStatus: "PAID",
          paymentMethod: method,
          paidAt: new Date(),
          status: "CONFIRMED",
        },
      });

      const wasNotConfirmed = beforeUpdate?.status.trim().toUpperCase() !== "CONFIRMED";
      const isDirect = beforeUpdate?.kind === "DIRECT";

      if (wasNotConfirmed && isDirect) {
        try {
          await sendBookingCompletionWhatsAppAfterPayment(bookingId);
        } catch (e) {
          console.error("[evolution-whatsapp] بعد تسجيل الدفع من المالية:", e);
        }
      }

      revalidatePath("/admin/financials");
      revalidatePath(`/admin/bookings/${bookingId}`);
      return { ok: true };
    } catch (e) {
      return { ok: false, error: "حدث خطأ أثناء تحديث حالة الدفع." };
    }
  }
  return { ok: false, error: "رقم الحجز غير صالح." };
}
