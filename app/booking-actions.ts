"use server";

import { revalidatePath } from "next/cache";
import {
  createDirectBooking,
  parseCommonBookingFieldsFromFormData,
} from "@/lib/direct-booking";
import { branchIdsFromReturnSlug } from "@/lib/booking-branches";
import { prisma } from "@/lib/prisma";
import { createNotification } from "@/lib/notification-service";
import { sendNewBookingNotificationEmails } from "@/lib/booking-notification-email";

type BookingActionState = { ok: boolean; error?: string };

const CAR_OPTIONS = new Set(["sedan", "suv", "sports"]);

export async function submitBookingRequest(
  _prev: BookingActionState | null,
  formData: FormData,
): Promise<BookingActionState> {
  const parsed = parseCommonBookingFieldsFromFormData(formData);
  if (!parsed.ok) {
    return parsed;
  }

  const carType = String(formData.get("carType") ?? "");
  if (!CAR_OPTIONS.has(carType)) {
    return { ok: false, error: "نوع السيارة غير صالح." };
  }

  const { data } = parsed;

  const branchIds = await branchIdsFromReturnSlug({
    returnBranchSlug: data.returnBranchSlug,
    pickupMode: "BRANCH",
  });
  if (!branchIds.returnBranchId) {
    return { ok: false, error: "الفرع غير متاح." };
  }

  let createdId: number;
  try {
    const created = await prisma.bookingRequest.create({
      data: {
        kind: "INQUIRY",
        fullName: data.fullName,
        phone: data.phone,
        ageRange: data.ageRange,
        carType,
        branchId: branchIds.branchId,
        returnBranchId: branchIds.returnBranchId,
        pickupMode: "BRANCH",
        pickupDate: data.pickupDate,
        numberOfDays: data.numberOfDays,
        termsAccepted: data.termsAccepted,
      },
      select: { id: true },
    });
    createdId = created.id;
  } catch (e) {
    console.error(e);
    return { ok: false, error: "تعذّر إرسال الطلب الآن، حاول مرة أخرى." };
  }

  // Trigger real-time notification for inquiry
  try {
    const targetBranchId = branchIds.branchId ?? branchIds.returnBranchId;
    await createNotification(
      { branchId: targetBranchId },
      "طلب استفسار جديد",
      `تم تقديم طلب استفسار جديد للعميل ${data.fullName}`
    );
  } catch (err) {
    console.error("[submitBookingRequest] Notification trigger error:", err);
  }

  await sendNewBookingNotificationEmails(createdId);

  revalidatePath("/admin");
  return { ok: true };
}

export async function submitDirectBookingRequest(
  _prev: BookingActionState | null,
  formData: FormData,
): Promise<BookingActionState> {
  const parsed = parseCommonBookingFieldsFromFormData(formData);
  if (!parsed.ok) {
    return parsed;
  }

  const carModelId = Number(formData.get("carModelId"));
  const created = await createDirectBooking({
    carModelId,
    ...parsed.data,
  });
  if (!created.ok) {
    return { ok: false, error: created.error };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/car-bookings");
  revalidatePath("/fleet");
  return { ok: true };
}
