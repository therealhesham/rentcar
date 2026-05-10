"use server";

import { revalidatePath } from "next/cache";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * تأكيد دفع تجريبي: يضع `paymentStatus = PAID` و `paidAt = الآن` على طلب الحجز.
 * لا يتعامل مع بوابة دفع حقيقية. الواجهة تتحقق من بطاقة وهمية فقط.
 */
export async function confirmMockPayment(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const id = Number(formData.get("bookingRequestId"));
  if (!Number.isInteger(id) || id < 1) {
    return { ok: false, error: "معرّف الطلب غير صالح." };
  }

  try {
    const updated = await prisma.bookingRequest.updateMany({
      where: { id, kind: "DIRECT", paymentStatus: "PENDING" },
      data: {
        paymentStatus: "PAID",
        paidAt: new Date(),
      },
    });
    if (updated.count === 0) {
      const exists = await prisma.bookingRequest.findUnique({
        where: { id },
        select: { paymentStatus: true, kind: true },
      });
      if (!exists || exists.kind !== "DIRECT") {
        return { ok: false, error: "الحجز غير موجود." };
      }
      if (exists.paymentStatus === "PAID") {
        return { ok: true };
      }
      return { ok: false, error: "تعذّر تحديث حالة الدفع." };
    }
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2025") {
      return { ok: false, error: "الحجز غير موجود." };
    }
    console.error(e);
    return { ok: false, error: "تعذّر تأكيد الدفع." };
  }

  revalidatePath(`/fleet/payment/${id}`);
  revalidatePath("/admin");
  revalidatePath("/admin/car-bookings");
  return { ok: true };
}
