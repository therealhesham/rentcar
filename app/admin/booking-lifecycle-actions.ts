"use server";

import { revalidatePath } from "next/cache";
import {
  assertBookingRequestInScope,
  requireAdminForAction,
} from "@/lib/admin-access";
import {
  recordBookingPickupFromBranch,
  recordBookingReturnToBranch,
  type LateReturnInfo,
} from "@/lib/booking-lifecycle-service";

export async function recordPickupFromBranchAction(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const bookingRequestId = Number(formData.get("bookingRequestId"));
  if (!Number.isInteger(bookingRequestId) || bookingRequestId < 1) {
    return { ok: false, error: "معرّف الطلب غير صالح." };
  }

  const scope = await assertBookingRequestInScope(auth.session, bookingRequestId);
  if (!scope.ok) return { ok: false, error: scope.error };

  const result = await recordBookingPickupFromBranch(bookingRequestId);
  if (!result.ok) return result;

  revalidatePath("/admin");
  revalidatePath("/admin/car-bookings");
  revalidatePath(`/admin/bookings/${bookingRequestId}`);
  revalidatePath(`/fleet/payment/${bookingRequestId}`);
  revalidatePath("/account");
  return { ok: true };
}

export type ReturnToBranchActionResult =
  | { ok: true }
  | { ok: false; error?: string }
  | { ok: false; needsLateDecision: true; lateInfo: LateReturnInfo };

export async function recordReturnToBranchAction(
  _prev: ReturnToBranchActionResult | null,
  formData: FormData,
): Promise<ReturnToBranchActionResult> {
  const auth = await requireAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const bookingRequestId = Number(formData.get("bookingRequestId"));
  if (!Number.isInteger(bookingRequestId) || bookingRequestId < 1) {
    return { ok: false, error: "معرّف الطلب غير صالح." };
  }

  const scope = await assertBookingRequestInScope(auth.session, bookingRequestId);
  if (!scope.ok) return { ok: false, error: scope.error };

  const decisionRaw = String(formData.get("latePenaltyDecision") ?? "")
    .trim()
    .toUpperCase();
  const latePenaltyDecision =
    decisionRaw === "APPLY" || decisionRaw === "WAIVE" ? decisionRaw : undefined;

  const result = await recordBookingReturnToBranch(bookingRequestId, {
    latePenaltyDecision,
    decidedBy: auth.session.displayName,
  });
  if (!result.ok) return result;

  revalidatePath("/admin");
  revalidatePath("/admin/car-bookings");
  revalidatePath("/admin/late-returns");
  revalidatePath("/admin/company-dues");
  revalidatePath(`/admin/bookings/${bookingRequestId}`);
  revalidatePath(`/fleet/payment/${bookingRequestId}`);
  revalidatePath("/account");
  return { ok: true };
}
