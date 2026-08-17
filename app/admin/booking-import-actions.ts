"use server";

import { revalidatePath } from "next/cache";
import { requirePermissionForAction } from "@/lib/admin-access";
import { importBookingsFromRows } from "@/lib/booking-import";
import type { BookingFieldMapping, BookingImportResult } from "@/lib/booking-import";

export type { ImportRow } from "@/lib/vehicle-import-excel";
export type { BookingFieldMapping, BookingImportResult } from "@/lib/booking-import";

function denied(error: string, dryRun: boolean): BookingImportResult {
  return {
    dryRun,
    total: 0,
    created: 0,
    skipped: 0,
    duplicates: 0,
    customersMatched: 0,
    customersToCreate: 0,
    totalAmountSar: 0,
    errors: [{ row: 0, message: error }],
    warnings: [],
  };
}

export async function importBookingsFromExcel(payload: {
  rows: Record<string, string>[];
  mapping: BookingFieldMapping;
  dryRun: boolean;
  defaultStatus?: string;
  defaultCarModelId?: number | null;
  defaultBranchId?: number | null;
}): Promise<BookingImportResult> {
  // صلاحية مستقلة عن `/admin/car-bookings` — الترحيل يكتب حجوزات ومبالغ مباشرة
  const auth = await requirePermissionForAction("/admin/car-bookings/import");
  if (!auth.ok) return denied(auth.error, payload.dryRun);

  const result = await importBookingsFromRows({
    rows: payload.rows,
    mapping: payload.mapping,
    dryRun: payload.dryRun,
    defaultStatus: payload.defaultStatus,
    defaultCarModelId: payload.defaultCarModelId,
    defaultBranchId: payload.defaultBranchId,
    actorName: auth.session.displayName,
  });

  if (!payload.dryRun && result.created > 0) {
    revalidatePath("/admin");
    revalidatePath("/admin/car-bookings");
    revalidatePath("/admin/customers");
    revalidatePath("/admin/fleet-availability");
  }

  return result;
}
