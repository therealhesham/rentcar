"use server";

import { revalidatePath } from "next/cache";
import { requireAdminForAction } from "@/lib/admin-access";
import { getVehicleUnitOptionsForModel } from "@/lib/vehicle-units";
import { prisma } from "@/lib/prisma";

export async function fetchVehicleUnitOptionsAction(modelId: number, branchId?: number | null) {
  const auth = await requireAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error, options: [] };
  const options = await getVehicleUnitOptionsForModel(modelId, branchId);
  return { ok: true, options };
}

export async function createVehicleUnitAction(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const plateNumber = String(formData.get("plateNumber") ?? "").trim();
  const chassisNumber = String(formData.get("chassisNumber") ?? "").trim() || null;
  const color = String(formData.get("color") ?? "").trim() || null;
  const carModelId = Number(formData.get("carModelId"));
  const branchIdRaw = formData.get("branchId");
  const branchId = branchIdRaw ? Number(branchIdRaw) : null;
  const status = String(formData.get("status") ?? "AVAILABLE").trim().toUpperCase();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!plateNumber) {
    return { ok: false, error: "يرجى كتابة رقم لوحة السيارة." };
  }
  if (!Number.isInteger(carModelId) || carModelId < 1) {
    return { ok: false, error: "يرجى اختيار موديل السيارة." };
  }

  try {
    const existing = await prisma.vehicleUnit.findUnique({
      where: { plateNumber },
    });
    if (existing) {
      return { ok: false, error: `رقم اللوحة "${plateNumber}" مسجل مسبقاً لمركبة أخرى.` };
    }

    await prisma.vehicleUnit.create({
      data: {
        plateNumber,
        chassisNumber,
        color,
        carModelId,
        branchId: Number.isInteger(branchId) && (branchId ?? 0) > 0 ? branchId : null,
        status: ["AVAILABLE", "RENTED", "MAINTENANCE", "INACTIVE"].includes(status) ? status : "AVAILABLE",
        notes,
      },
    });

    revalidatePath("/admin/vehicle-units");
    revalidatePath("/admin/car-bookings");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "حدث خطأ غير متوقع.";
    return { ok: false, error: msg };
  }
}

export async function updateVehicleUnitAction(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  const unitId = Number(formData.get("unitId"));
  if (!Number.isInteger(unitId) || unitId < 1) {
    return { ok: false, error: "معرف وحدة السيارة غير صالح." };
  }

  const plateNumber = String(formData.get("plateNumber") ?? "").trim();
  const chassisNumber = String(formData.get("chassisNumber") ?? "").trim() || null;
  const color = String(formData.get("color") ?? "").trim() || null;
  const carModelId = Number(formData.get("carModelId"));
  const branchIdRaw = formData.get("branchId");
  const branchId = branchIdRaw ? Number(branchIdRaw) : null;
  const status = String(formData.get("status") ?? "AVAILABLE").trim().toUpperCase();
  const notes = String(formData.get("notes") ?? "").trim() || null;

  if (!plateNumber) {
    return { ok: false, error: "يرجى كتابة رقم لوحة السيارة." };
  }

  try {
    const existing = await prisma.vehicleUnit.findFirst({
      where: { plateNumber, NOT: { id: unitId } },
    });
    if (existing) {
      return { ok: false, error: `رقم اللوحة "${plateNumber}" مسجل مسبقاً لمركبة أخرى.` };
    }

    await prisma.vehicleUnit.update({
      where: { id: unitId },
      data: {
        plateNumber,
        chassisNumber,
        color,
        carModelId,
        branchId: Number.isInteger(branchId) && (branchId ?? 0) > 0 ? branchId : null,
        status: ["AVAILABLE", "RENTED", "MAINTENANCE", "INACTIVE"].includes(status) ? status : "AVAILABLE",
        notes,
      },
    });

    revalidatePath("/admin/vehicle-units");
    revalidatePath("/admin/car-bookings");
    return { ok: true };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "حدث خطأ غير متوقع.";
    return { ok: false, error: msg };
  }
}

export async function deleteVehicleUnitAction(unitId: number): Promise<{ ok: boolean; error?: string }> {
  const auth = await requireAdminForAction();
  if (!auth.ok) return { ok: false, error: auth.error };

  try {
    await prisma.vehicleUnit.delete({ where: { id: unitId } });
    revalidatePath("/admin/vehicle-units");
    revalidatePath("/admin/car-bookings");
    return { ok: true };
  } catch {
    return { ok: false, error: "تعذر حذف لوحة السيارة لوجود حجوزات مرتبطة بها." };
  }
}
