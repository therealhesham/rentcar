"use server";

import { revalidatePath } from "next/cache";
import { verifyAdminSession } from "@/lib/admin-auth";
import {
  createDirectBooking,
  parseCommonBookingFieldsFromFormData,
} from "@/lib/direct-booking";

export async function submitAdminDirectBooking(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  if (!(await verifyAdminSession())) {
    return { ok: false, error: "غير مصرّح." };
  }

  const carModelId = Number(formData.get("carModelId"));
  if (!Number.isInteger(carModelId) || carModelId < 1) {
    return { ok: false, error: "اختر المركبة." };
  }

  const parsed = parseCommonBookingFieldsFromFormData(formData);
  if (!parsed.ok) {
    return parsed;
  }

  const created = await createDirectBooking({
    carModelId,
    ...parsed.data,
  });
  if (!created.ok) {
    return { ok: false, error: created.error };
  }

  revalidatePath("/admin");
  revalidatePath("/admin/car-bookings");
  revalidatePath("/admin/customers");
  revalidatePath("/admin/fleet-availability");
  revalidatePath("/fleet");
  return { ok: true };
}
