"use server";

import { revalidatePath } from "next/cache";
import { requireAdminForAction } from "@/lib/admin-access";
import { importVehicleUnits } from "@/lib/vehicle-unit-import";
import type { UnitFieldMapping, UnitImportResult } from "@/lib/vehicle-unit-import";

export type { ImportRow } from "@/lib/vehicle-import-excel";
export type { UnitFieldMapping, UnitImportResult } from "@/lib/vehicle-unit-import";

export async function importVehicleUnitsFromExcel(payload: {
  rows: Record<string, string>[];
  mapping: UnitFieldMapping;
  defaultCarModelId?: number | null;
  defaultBranchId?: number | null;
  defaultStatus?: string;
  onDuplicate?: "update" | "skip";
}): Promise<UnitImportResult> {
  const auth = await requireAdminForAction();
  if (!auth.ok) {
    return { total: 0, created: 0, updated: 0, skipped: 0, errors: [{ row: 0, message: auth.error }] };
  }

  const result = await importVehicleUnits(payload);

  revalidatePath("/admin/vehicle-units");
  revalidatePath("/admin/car-bookings");
  return result;
}
