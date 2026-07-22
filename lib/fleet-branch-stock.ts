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
  /** undefined = لا تغيير؛ null = مسح سعر الفرع (يرجع لسعر الموديل)؛ رقم = سعر خاص بالفرع دون ضريبة. */
  pricePerDayExclTax?: number | null;
  /** undefined = لا تغيير؛ null = مسح السعر الشهري الخاص بالفرع؛ رقم = سعر شهري خاص بالفرع دون ضريبة. */
  priceMonthlyExclTax?: number | null;
}): Promise<void> {
  const qty = Math.max(0, Math.round(input.quantity));
  const pricePatch =
    input.pricePerDayExclTax === undefined
      ? {}
      : {
          pricePerDayExclTax:
            input.pricePerDayExclTax == null
              ? null
              : Math.max(0, Math.round(input.pricePerDayExclTax * 100) / 100),
        };
  const monthlyPatch =
    input.priceMonthlyExclTax === undefined
      ? {}
      : {
          priceMonthlyExclTax:
            input.priceMonthlyExclTax == null
              ? null
              : Math.max(0, Math.round(input.priceMonthlyExclTax * 100) / 100),
        };
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
      ...pricePatch,
      ...monthlyPatch,
    },
    update: { quantity: qty, ...pricePatch, ...monthlyPatch },
  });
}

/** السعر اليومي الأساسي (دون ضريبة) للموديل في فرع محدّد: تجاوز الفرع إن وُجد وإلا سعر الموديل. */
export async function resolveBranchBasePriceForModel(
  modelId: number,
  branchId: number | null,
  modelPriceExclTax: number,
): Promise<number> {
  if (!branchId) return modelPriceExclTax;
  const row = await prisma.fleet.findUnique({
    where: { modelId_branchId: { modelId, branchId } },
    select: { pricePerDayExclTax: true },
  });
  return row?.pricePerDayExclTax ?? modelPriceExclTax;
}

/** أدنى سعر أساسي بين الفروع النشطة ذات المخزون — لعرض «يبدأ من» قبل اختيار الفرع. */
export async function minBranchBasePriceForModel(
  modelId: number,
  modelPriceExclTax: number,
): Promise<{ minPrice: number; variesAcrossBranches: boolean }> {
  const rows = await prisma.fleet.findMany({
    where: { modelId, quantity: { gt: 0 }, branch: { isActive: true } },
    select: { pricePerDayExclTax: true },
  });
  if (rows.length === 0) {
    return { minPrice: modelPriceExclTax, variesAcrossBranches: false };
  }
  const prices = rows.map((r) => r.pricePerDayExclTax ?? modelPriceExclTax);
  const minPrice = Math.min(...prices);
  // فروق أقل من ريال غير مرئية بعد تقريب العرض
  const variesAcrossBranches = new Set(prices.map((p) => Math.round(p))).size > 1;
  return { minPrice, variesAcrossBranches };
}

/** السعر الشهري الأساسي (دون ضريبة) للموديل في فرع محدّد: تجاوز الفرع إن وُجد وإلا سعر الموديل الشهري. null = لا يوجد عرض شهري. */
export async function resolveBranchMonthlyPriceForModel(
  modelId: number,
  branchId: number | null,
  modelMonthlyPriceExclTax: number | null,
): Promise<number | null> {
  if (!branchId) return modelMonthlyPriceExclTax;
  const row = await prisma.fleet.findUnique({
    where: { modelId_branchId: { modelId, branchId } },
    select: { priceMonthlyExclTax: true },
  });
  return row?.priceMonthlyExclTax ?? modelMonthlyPriceExclTax;
}

/** أدنى سعر شهري بين الفروع النشطة ذات المخزون — لعرض «يبدأ من» قبل اختيار الفرع. null = لا يوجد عرض شهري لهذا الموديل في أي فرع. */
export async function minBranchMonthlyPriceForModel(
  modelId: number,
  modelMonthlyPriceExclTax: number | null,
): Promise<{ minPrice: number | null; variesAcrossBranches: boolean }> {
  const rows = await prisma.fleet.findMany({
    where: { modelId, quantity: { gt: 0 }, branch: { isActive: true } },
    select: { priceMonthlyExclTax: true },
  });
  const prices = rows
    .map((r) => r.priceMonthlyExclTax ?? modelMonthlyPriceExclTax)
    .filter((p): p is number => p != null);
  if (prices.length === 0) {
    return { minPrice: modelMonthlyPriceExclTax, variesAcrossBranches: false };
  }
  const minPrice = Math.min(...prices);
  const variesAcrossBranches = new Set(prices.map((p) => Math.round(p))).size > 1;
  return { minPrice, variesAcrossBranches };
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
