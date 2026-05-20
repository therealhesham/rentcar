import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type FleetClient = {
  fleet: typeof prisma.fleet;
};

export async function resolveBranchIdFromSlug(
  branchSlug: string,
): Promise<number | null> {
  const slug = branchSlug.trim().toLowerCase();
  if (!slug) return null;
  const row = await prisma.branch.findFirst({
    where: { slug, isActive: true },
    select: { id: true },
  });
  return row?.id ?? null;
}

/** مجموع الوحدات المتاحة من الموديل في فرع (slug أو id). */
export async function sumFleetQuantityForModelAtBranch(
  client: FleetClient,
  carModelId: number,
  branch: { branchId: number } | { branchSlug: string },
): Promise<number> {
  let branchId: number | null =
    "branchId" in branch ? branch.branchId : null;
  if ("branchSlug" in branch) {
    branchId = await resolveBranchIdFromSlug(branch.branchSlug);
  }
  if (!branchId) return 0;

  const agg = await client.fleet.aggregate({
    where: { modelId: carModelId, branchId },
    _sum: { quantity: true },
  });
  return Math.max(0, agg._sum.quantity ?? 0);
}

export async function upsertBranchFleetQuantity(input: {
  branchId: number;
  modelId: number;
  quantity: number;
}): Promise<void> {
  const qty = Math.max(0, Math.round(input.quantity));
  await prisma.fleet.upsert({
    where: {
      modelId_branchId: {
        modelId: input.modelId,
        branchId: input.branchId,
      },
    },
    create: {
      modelId: input.modelId,
      branchId: input.branchId,
      quantity: qty,
    },
    update: { quantity: qty },
  });
}

export type BranchFleetQuantityRow = {
  modelId: number;
  branchId: number;
  quantity: number;
};

export async function listFleetQuantitiesForBranch(
  branchId: number,
): Promise<Map<number, number>> {
  const rows = await prisma.fleet.findMany({
    where: { branchId },
    select: { modelId: true, quantity: true },
  });
  return new Map(rows.map((r) => [r.modelId, r.quantity]));
}

/** موديلات لها كمية > 0 في الفرع */
export async function listModelIdsWithStockAtBranch(
  branchId: number,
): Promise<number[]> {
  const rows = await prisma.fleet.findMany({
    where: { branchId, quantity: { gt: 0 } },
    select: { modelId: true },
    distinct: ["modelId"],
  });
  return rows.map((r) => r.modelId);
}

export function fleetWhereForBranchSlug(
  branchSlug: string,
): Prisma.FleetWhereInput {
  return {
    quantity: { gt: 0 },
    branch: { slug: branchSlug.trim().toLowerCase(), isActive: true },
  };
}

type FleetTxClient = Pick<typeof prisma, "fleet">;

/** تعديل الكمية بعدة وحدات (لا تقل عن صفر). */
export async function adjustFleetQuantityDelta(
  client: FleetTxClient,
  modelId: number,
  branchId: number,
  delta: number,
): Promise<void> {
  const row = await client.fleet.findUnique({
    where: { modelId_branchId: { modelId, branchId } },
    select: { quantity: true },
  });
  const next = Math.max(0, (row?.quantity ?? 0) + Math.round(delta));
  await client.fleet.upsert({
    where: { modelId_branchId: { modelId, branchId } },
    create: { modelId, branchId, quantity: next },
    update: { quantity: next },
  });
}
