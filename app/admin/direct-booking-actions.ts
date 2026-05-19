"use server";

import { revalidatePath } from "next/cache";
import { enforceBranchOnFormData, requireAdminForAction } from "@/lib/admin-access";
import {
  createDirectBooking,
  parseCommonBookingFieldsFromFormData,
} from "@/lib/direct-booking";

export async function submitAdminDirectBooking(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
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
