"use server";

import { revalidatePath } from "next/cache";
import { requirePermissionForAction } from "@/lib/admin-access";
import {
  cancelAvailabilityBlock,
  importAvailabilityBlocksFromRows,
} from "@/lib/availability-block-import";
import type {
  AvailabilityBlockFieldMapping,
  AvailabilityImportResult,
} from "@/lib/availability-block-import";

export type { ImportRow } from "@/lib/vehicle-import-excel";
export type {
  AvailabilityBlockFieldMapping,
  AvailabilityImportResult,
} from "@/lib/availability-block-import";

const PERMISSION_ID = "/admin/fleet-availability/import";

function denied(error: string, dryRun: boolean): AvailabilityImportResult {
  return {
    dryRun,
    total: 0,
    created: 0,
    skipped: 0,
    duplicates: 0,
    customersMatched: 0,
    customersToCreate: 0,
    errors: [{ row: 0, message: error }],
    warnings: [],
  };
}

export async function importAvailabilityBlocksFromExcel(payload: {
  rows: Record<string, string>[];
  mapping: AvailabilityBlockFieldMapping;
  dryRun: boolean;
}): Promise<AvailabilityImportResult> {
  // صلاحية مستقلة عن `/admin/fleet-availability` — عرض التوفر لا يعني إذناً بتعديله
  const auth = await requirePermissionForAction(PERMISSION_ID);
  if (!auth.ok) return denied(auth.error, payload.dryRun);

  const result = await importAvailabilityBlocksFromRows({
    rows: payload.rows,
    mapping: payload.mapping,
    dryRun: payload.dryRun,
    actorName: auth.session.displayName,
  });

  if (!payload.dryRun && result.created > 0) {
    revalidatePath("/admin/fleet-availability");
    revalidatePath("/admin/customers");
  }

  return result;
}

export async function cancelAvailabilityBlockAction(
  _prev: { ok: boolean; error?: string } | null,
  formData: FormData,
): Promise<{ ok: boolean; error?: string }> {
  const auth = await requirePermissionForAction(PERMISSION_ID);
  if (!auth.ok) return { ok: false, error: auth.error };

  const id = Number(formData.get("id"));
  if (!Number.isInteger(id) || id < 1) {
    return { ok: false, error: "معرّف غير صالح." };
  }

  const result = await cancelAvailabilityBlock(id, auth.session.displayName);
  if (!result.ok) return result;

  revalidatePath("/admin/fleet-availability");
  return { ok: true };
}
