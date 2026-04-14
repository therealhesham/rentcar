"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/admin-auth";
import { getDirectBookingAvailability } from "@/lib/direct-booking";
import { prisma } from "@/lib/prisma";

export async function convertInquiryToDirect(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await verifyAdminSession())) {
    return { ok: false, error: "غير مصرّح." };
  }

  const bookingRequestId = Number(formData.get("bookingRequestId"));
  const carModelId = Number(formData.get("carModelId"));

  if (!Number.isInteger(bookingRequestId) || bookingRequestId < 1) {
    return { ok: false, error: "معرّف الطلب غير صالح." };
  }
  if (!Number.isInteger(carModelId) || carModelId < 1) {
    return { ok: false, error: "اختر موديل السيارة." };
  }

  const booking = await prisma.bookingRequest.findUnique({
    where: { id: bookingRequestId },
    select: {
      id: true,
      kind: true,
      pickupDate: true,
      numberOfDays: true,
    },
  });
  if (!booking) {
    return { ok: false, error: "الطلب غير موجود." };
  }
  if (booking.kind !== "INQUIRY") {
    return { ok: false, error: "يمكن تحويل طلبات الاستفسار فقط." };
  }

  const model = await prisma.carModel.findUnique({
    where: { id: carModelId },
    include: { category: true },
  });
  if (!model) {
    return { ok: false, error: "الموديل غير موجود." };
  }

  const { available, fleetUnits, overlapping } = await getDirectBookingAvailability({
    carModelId,
    pickupDate: booking.pickupDate,
    numberOfDays: booking.numberOfDays,
  });
  if (!available) {
    return {
      ok: false,
      error: `السيارة غير متاحة في فترة هذا الطلب (${booking.numberOfDays} يوم/أيام): ${overlapping} حجز متزامن والحد ${fleetUnits} وحدة/وحدات.`,
    };
  }

  const carType = model.category.slug || model.category.title;

  try {
    await prisma.bookingRequest.update({
      where: { id: bookingRequestId },
      data: {
        kind: "DIRECT",
        carModelId,
        carType,
      },
    });
  } catch (e) {
    console.error(e);
    return { ok: false, error: "تعذّر تحديث الطلب." };
  }

  revalidatePath("/admin");
  revalidatePath("/fleet");
  return { ok: true };
}
