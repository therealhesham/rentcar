"use server";

import { revalidatePath } from "next/cache";
import {
  createDirectBooking,
  parseCommonBookingFieldsFromFormData,
} from "@/lib/direct-booking";
import { prisma } from "@/lib/prisma";

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

  try {
    await prisma.bookingRequest.create({
      data: {
        kind: "INQUIRY",
        fullName: data.fullName,
        phone: data.phone,
        ageRange: data.ageRange,
        carType,
        branch: data.branch,
        pickupDate: data.pickupDate,
        numberOfDays: data.numberOfDays,
        termsAccepted: data.termsAccepted,
      },
    });
  } catch (e) {
    console.error(e);
    return { ok: false, error: "تعذّر إرسال الطلب الآن، حاول مرة أخرى." };
  }

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
  revalidatePath("/fleet");
  return { ok: true };
}
