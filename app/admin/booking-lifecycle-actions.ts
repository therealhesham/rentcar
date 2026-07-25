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
import { logBookingEvent } from "@/lib/booking-audit";
import { prisma } from "@/lib/prisma";

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

  const vehicleUnitIdRaw = formData.get("vehicleUnitId");
  const vehicleUnitId = vehicleUnitIdRaw ? Number(vehicleUnitIdRaw) : undefined;
  const vehiclePlateNumber = String(formData.get("vehiclePlateNumber") ?? "").trim() || undefined;

  const result = await recordBookingPickupFromBranch(bookingRequestId, {
    vehicleUnitId: Number.isInteger(vehicleUnitId) && (vehicleUnitId ?? 0) > 0 ? vehicleUnitId : undefined,
    vehiclePlateNumber,
  });
  if (!result.ok) return result;

  await logBookingEvent({
    bookingId: bookingRequestId,
    event: "VEHICLE_PICKED_UP",
    actorKind: "ADMIN",
    actorName: auth.session.displayName,
    toStatus: "PICKED_UP",
    notes: vehiclePlateNumber ? `تم ربط السيارة ذات اللوحة: ${vehiclePlateNumber}` : undefined,
  });

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

  await logBookingEvent({
    bookingId: bookingRequestId,
    event: "VEHICLE_RETURNED",
    actorKind: "ADMIN",
    actorName: auth.session.displayName,
    toStatus: "RETURNED",
    notes: latePenaltyDecision === "APPLY"
      ? "تم تطبيق غرامة التأخير"
      : latePenaltyDecision === "WAIVE"
        ? "تم إعفاء العميل من غرامة التأخير"
        : undefined,
  });

  revalidatePath("/admin");
  revalidatePath("/admin/car-bookings");
  revalidatePath("/admin/late-returns");
  revalidatePath("/admin/company-dues");
  revalidatePath(`/admin/bookings/${bookingRequestId}`);
  revalidatePath(`/fleet/payment/${bookingRequestId}`);
  revalidatePath("/account");
  return { ok: true };
}

export async function updateBookingVehiclePlateAction(
  bookingRequestId: number,
  vehicleUnitId?: number | null,
  vehiclePlateNumber?: string | null,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const scope = await assertBookingRequestInScope(auth.session, bookingRequestId);
  if (!scope.ok) return { ok: false, error: scope.error };

  let finalUnitId = vehicleUnitId ?? null;
  let finalPlateNumber = vehiclePlateNumber?.trim() || null;

  if (finalUnitId && !finalPlateNumber) {
    const unit = await prisma.vehicleUnit.findUnique({ where: { id: finalUnitId } });
    if (unit) finalPlateNumber = unit.plateNumber;
  } else if (!finalUnitId && finalPlateNumber) {
    const unit = await prisma.vehicleUnit.findUnique({ where: { plateNumber: finalPlateNumber } });
    if (unit) finalUnitId = unit.id;
  }

  await prisma.bookingRequest.update({
    where: { id: bookingRequestId },
    data: {
      vehicleUnitId: finalUnitId,
      vehiclePlateNumber: finalPlateNumber,
    },
  });

  if (finalUnitId) {
    await prisma.vehicleUnit.update({
      where: { id: finalUnitId },
      data: { status: "RENTED" },
    });
  }

  await logBookingEvent({
    bookingId: bookingRequestId,
    event: "BOOKING_UPDATED",
    actorKind: "ADMIN",
    actorName: auth.session.displayName,
    notes: finalPlateNumber ? `تم تحديث لوحة السيارة إلى: ${finalPlateNumber}` : "تم إزالة ربط رقم اللوحة",
  });

  revalidatePath("/admin");
  revalidatePath("/admin/car-bookings");
  revalidatePath(`/admin/bookings/${bookingRequestId}`);

  return { ok: true };
}
