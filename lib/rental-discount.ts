import type { RentalDiscountKind } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type RentalDiscountRule = {
  id: number;
  kind: RentalDiscountKind;
  value: number;
  startsAt: Date | null;
  endsAt: Date | null;
  brandId: number | null;
  carModelId: number | null;
  branchId: number | null;
  sortOrder: number;
};

export type RentalDiscountContext = {
  brandId: number;
  carModelId: number;
  branchId?: number | null;
  /** تاريخ الاستلام أو «الآن» لعرض الأسطول */
  referenceDate?: Date | null;
};

/** نتيجة الخصم للعميل — بدون تفاصيل الشرط (فترة/ماركة/فرع). */
export type ResolvedRentalDiscount = {
  originalPricePerDayExclTax: number;
  discountedPricePerDayExclTax: number;
  discountPerDayExclTax: number;
  /** نص مختصر للعرض: «خصم ١٠٪» أو «وفّرت ٥٠ ر.س» */
  displayLabelAr: string;
};

let cachedActiveDiscounts: RentalDiscountRule[] | null = null;
let cachedAtMs = 0;
const CACHE_TTL_MS = 30_000;

export async function getActiveRentalDiscounts(): Promise<RentalDiscountRule[]> {
  const now = Date.now();
  if (cachedActiveDiscounts && now - cachedAtMs < CACHE_TTL_MS) {
    return cachedActiveDiscounts;
  }
  const rows = await prisma.rentalDiscount.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      id: true,
      kind: true,
      value: true,
      startsAt: true,
      endsAt: true,
      brandId: true,
      carModelId: true,
      branchId: true,
      sortOrder: true,
    },
  });
  cachedActiveDiscounts = rows;
  cachedAtMs = now;
  return rows;
}

export function invalidateRentalDiscountCache(): void {
  cachedActiveDiscounts = null;
  cachedAtMs = 0;
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function isWithinDiscountPeriod(
  rule: Pick<RentalDiscountRule, "startsAt" | "endsAt">,
  referenceDate: Date,
): boolean {
  const refDay = startOfUtcDay(referenceDate).getTime();
  if (rule.startsAt) {
    const startDay = startOfUtcDay(rule.startsAt).getTime();
    if (refDay < startDay) return false;
  }
  if (rule.endsAt) {
    const endDay = startOfUtcDay(rule.endsAt).getTime();
    if (refDay > endDay) return false;
  }
  return true;
}

function discountMatchesContext(rule: RentalDiscountRule, ctx: RentalDiscountContext): boolean {
  if (rule.brandId != null && rule.brandId !== ctx.brandId) return false;
  if (rule.carModelId != null && rule.carModelId !== ctx.carModelId) return false;
  if (rule.branchId != null) {
    if (ctx.branchId == null || rule.branchId !== ctx.branchId) return false;
  }
  const ref = ctx.referenceDate ?? new Date();
  if (!isWithinDiscountPeriod(rule, ref)) return false;
  return true;
}

export function computeDiscountedDailyPrice(
  basePricePerDayExclTax: number,
  kind: RentalDiscountKind,
  value: number,
): { discounted: number; savingsPerDay: number } {
  const base = Math.max(0, Math.round(basePricePerDayExclTax));
  if (base <= 0) return { discounted: 0, savingsPerDay: 0 };

  let savings = 0;
  if (kind === "PERCENT") {
    const pct = Math.min(100, Math.max(1, Math.round(value)));
    savings = Math.round((base * pct) / 100);
  } else {
    savings = Math.min(base, Math.max(0, Math.round(value)));
  }
  if (savings <= 0) return { discounted: base, savingsPerDay: 0 };
  return { discounted: base - savings, savingsPerDay: savings };
}

export function buildCustomerDiscountLabelAr(
  kind: RentalDiscountKind,
  value: number,
  savingsPerDay: number,
): string {
  if (savingsPerDay <= 0) return "";
  if (kind === "PERCENT") {
    const pct = Math.min(100, Math.max(1, Math.round(value)));
    return `خصم ${pct.toLocaleString("ar-SA")}٪`;
  }
  return `وفّرت ${savingsPerDay.toLocaleString("en-US")} ر.س`;
}

export function resolveBestRentalDiscount(
  rules: ReadonlyArray<RentalDiscountRule>,
  ctx: RentalDiscountContext,
  basePricePerDayExclTax: number,
): ResolvedRentalDiscount | null {
  const base = Math.max(0, Math.round(basePricePerDayExclTax));
  if (base <= 0) return null;

  let best: { resolved: ResolvedRentalDiscount; sortOrder: number } | null = null;

  for (const rule of rules) {
    if (!discountMatchesContext(rule, ctx)) continue;
    const { discounted, savingsPerDay } = computeDiscountedDailyPrice(base, rule.kind, rule.value);
    if (savingsPerDay <= 0) continue;

    const candidate: ResolvedRentalDiscount = {
      originalPricePerDayExclTax: base,
      discountedPricePerDayExclTax: discounted,
      discountPerDayExclTax: savingsPerDay,
      displayLabelAr: buildCustomerDiscountLabelAr(rule.kind, rule.value, savingsPerDay),
    };

    if (
      !best ||
      candidate.discountPerDayExclTax > best.resolved.discountPerDayExclTax ||
      (candidate.discountPerDayExclTax === best.resolved.discountPerDayExclTax &&
        rule.sortOrder < best.sortOrder)
    ) {
      best = { resolved: candidate, sortOrder: rule.sortOrder };
    }
  }

  return best?.resolved ?? null;
}

export async function resolveRentalDiscountForModel(
  basePricePerDayExclTax: number,
  ctx: RentalDiscountContext,
): Promise<ResolvedRentalDiscount | null> {
  const rules = await getActiveRentalDiscounts();
  return resolveBestRentalDiscount(rules, ctx, basePricePerDayExclTax);
}

export type RentalDiscountPriceSnap = {
  originalPricePerDayExclTax: number;
  discountedPricePerDayExclTax: number;
  discountPerDayExclTax: number;
};

export function rentalDiscountSnapFromResolved(
  resolved: ResolvedRentalDiscount,
): RentalDiscountPriceSnap {
  return {
    originalPricePerDayExclTax: resolved.originalPricePerDayExclTax,
    discountedPricePerDayExclTax: resolved.discountedPricePerDayExclTax,
    discountPerDayExclTax: resolved.discountPerDayExclTax,
  };
}
