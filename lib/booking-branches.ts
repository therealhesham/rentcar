/**
 * Booking branch helpers.
 * Field glossary (EN name / AR meaning): docs/booking-request-branch-fields.md
 */
import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type BookingBranchRow = {
  branchId: number | null;
  returnBranchId: number | null;
  pickupMode: string | null;
  addonsJson: string | null;
  pickupBranch?: { slug: string; name?: string } | null;
  returnBranch?: { slug: string; name?: string } | null;
};

/** slug فرع الاستلام من العلاقة أو JSON قديم */
export function resolvePickupBranchSlug(row: BookingBranchRow): string | null {
  if (row.pickupMode === "DELIVERY") return null;
  const fromRel = row.pickupBranch?.slug?.trim().toLowerCase();
  if (fromRel) return fromRel;
  if (row.branchId == null) return legacyPickupSlugFromAddons(row.addonsJson);
  return null;
}

/** slug فرع الإرجاع */
export function resolveReturnBranchSlug(row: BookingBranchRow): string | null {
  const fromRel = row.returnBranch?.slug?.trim().toLowerCase();
  if (fromRel) return fromRel;
  return null;
}

function legacyPickupSlugFromAddons(addonsJson: string | null | undefined): string | null {
  if (!addonsJson?.trim()) return null;
  try {
    const o = JSON.parse(addonsJson) as { pickupBranchSlug?: string };
    const s = o.pickupBranchSlug?.trim().toLowerCase();
    return s || null;
  } catch {
    return null;
  }
}

export function isInterBranchPickupReturn(row: BookingBranchRow): boolean {
  if (row.pickupMode === "DELIVERY") return false;
  if (row.branchId != null && row.returnBranchId != null) {
    return row.branchId !== row.returnBranchId;
  }
  const pickup = resolvePickupBranchSlug(row);
  const ret = resolveReturnBranchSlug(row);
  if (!pickup || !ret) return false;
  return pickup !== ret;
}

export async function resolveBranchIdFromSlug(slug: string): Promise<number | null> {
  const s = slug.trim().toLowerCase();
  if (!s) return null;
  const row = await prisma.branch.findFirst({
    where: { slug: s, isActive: true },
    select: { id: true },
  });
  return row?.id ?? null;
}

export async function resolveBranchIdsFromSlugs(input: {
  pickupSlug: string | null;
  returnSlug: string;
}): Promise<{ pickupBranchId: number | null; returnBranchId: number | null }> {
  const returnBranchId = await resolveBranchIdFromSlug(input.returnSlug);
  const pickupBranchId = input.pickupSlug
    ? await resolveBranchIdFromSlug(input.pickupSlug)
    : null;
  return { pickupBranchId, returnBranchId };
}

/** تصفية حجوزات موظف الفرع: استلام أو إرجاع عند فرعه */
export function bookingInBranchScope(
  branchSlug: string,
): Prisma.BookingRequestWhereInput {
  const slug = branchSlug.trim().toLowerCase();
  return {
    OR: [{ pickupBranch: { slug } }, { returnBranch: { slug } }],
  };
}

/** إحصائيات وتقارير حسب فرع الاستلام */
export function bookingPickupBranchScope(
  branchSlug: string,
): Prisma.BookingRequestWhereInput {
  return { pickupBranch: { slug: branchSlug.trim().toLowerCase() } };
}

/** مرتجعات ومخزون حسب فرع الإرجاع */
export function bookingReturnBranchScope(
  branchSlug: string,
): Prisma.BookingRequestWhereInput {
  return { returnBranch: { slug: branchSlug.trim().toLowerCase() } };
}

export const bookingBranchRelationsSelect = {
  pickupBranch: { select: { slug: true, name: true } },
  returnBranch: { select: { slug: true, name: true } },
} as const;

/** حفظ فروع الحجز من slug فرع الإرجاع (نموذج الإدارة / الاستفسار). */
export async function branchIdsFromReturnSlug(input: {
  returnBranchSlug: string;
  pickupMode: string | null;
  preservePickupBranchId?: number | null;
}): Promise<{ branchId: number | null; returnBranchId: number | null }> {
  const returnBranchId = await resolveBranchIdFromSlug(input.returnBranchSlug);
  if (!returnBranchId) return { branchId: null, returnBranchId: null };
  if (input.pickupMode === "DELIVERY") {
    return { branchId: null, returnBranchId };
  }
  const branchId = input.preservePickupBranchId ?? returnBranchId;
  return { branchId, returnBranchId };
}
