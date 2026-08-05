/**
 * الحد الأدنى للسعر (دون ضريبة) — يمنع الخصومات وأكواد الخصم من إنزال سعر
 * الإيجار تحت أرضية محدَّدة إدارياً.
 *
 * الأرضية **دون ضريبة** بالتعريف، فالمقارنة تتم دائماً قبل احتساب ضريبة القيمة
 * المضافة، ثم `computeCheckoutTotals` تحسب الضريبة على النتيجة النهائية.
 *
 * مصدر الأرضية: `Fleet.min*` للفرع إن وُجد، وإلا `CarModel.min*` — نفس نمط
 * `resolveBranchBasePriceForModel` بالضبط. null = بلا حد.
 */
import { prisma } from "@/lib/prisma";

export type RentalPeriodKind = "DAILY" | "MONTHLY";

/** أرضية السعر الفعّالة لموديل في فرع محدَّد (دون ضريبة). null = بلا حد. */
export type ResolvedPriceFloor = {
  minPricePerDayExclTax: number | null;
  /** أرضية **إجمالي** الشهر (مش لليوم) — تُقارَن بإجمالي الإيجار الشهري. */
  minPriceMonthlyExclTax: number | null;
};

export const NO_PRICE_FLOOR: ResolvedPriceFloor = {
  minPricePerDayExclTax: null,
  minPriceMonthlyExclTax: null,
};

/** أرضية السعر لموديل في فرع: تجاوز الفرع إن وُجد وإلا حد الموديل. */
export async function resolvePriceFloorForModel(
  modelId: number,
  branchId: number | null,
  modelFloor: ResolvedPriceFloor,
): Promise<ResolvedPriceFloor> {
  if (!branchId) return modelFloor;
  const row = await prisma.fleet.findUnique({
    where: { modelId_branchId: { modelId, branchId } },
    select: { minPricePerDayExclTax: true, minPriceMonthlyExclTax: true },
  });
  return {
    minPricePerDayExclTax:
      row?.minPricePerDayExclTax ?? modelFloor.minPricePerDayExclTax,
    minPriceMonthlyExclTax:
      row?.minPriceMonthlyExclTax ?? modelFloor.minPriceMonthlyExclTax,
  };
}

export type PriceFloorOutcome = {
  /** السعر اليومي النهائي بعد احترام الأرضية (دون ضريبة). */
  finalPricePerDayExclTax: number;
  /** السعر اليومي بعد الخصم وقبل تطبيق الأرضية. */
  discountedPricePerDayExclTax: number;
  /** السعر اليومي الأساسي قبل أي خصم. */
  basePricePerDayExclTax: number;
  /** الأرضية محوَّلة لمكافئ يومي (شهري ÷ الأيام) — null = بلا حد. */
  floorPerDayExclTax: number | null;
  /** true = الأرضية ألغت جزءاً من الخصم فعلياً (تستوجب تسجيل ومتابعة). */
  floorApplied: boolean;
  /** المبلغ المحجوب من الخصم بسبب الأرضية لكامل المدة (دون ضريبة). */
  withheldDiscountExclTax: number;
  /**
   * true = الأرضية المضبوطة أعلى من السعر الأساسي نفسه (خطأ إعداد).
   * في هذه الحالة لا نرفع السعر فوق المعلن للعميل — نكتفي بالسعر الأساسي
   * ونرفع العلم للإدارة لتصحيح الإعداد.
   */
  floorExceedsBasePrice: boolean;
  periodKind: RentalPeriodKind;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * يطبّق الأرضية على السعر اليومي بعد الخصم.
 *
 * المعادلة: `final = min(base, max(discounted, floor))`
 *
 * الحد الأعلى بـ `base` مقصود: لو الأرضية أعلى من السعر الأساسي (سوء إعداد)
 * فرفع السعر فوق المعلن للعميل خطأ أفدح من تجاهل الأرضية — نُبقي السعر الأساسي
 * ونرفع `floorExceedsBasePrice` للإدارة.
 *
 * للتأجير الشهري: `minPriceMonthlyExclTax` أرضية لإجمالي الشهر، وتُحوَّل هنا
 * لمكافئ يومي بالقسمة على عدد الأيام — لأن `computeCheckoutTotals` تشتغل
 * بسعر يومي × أيام، فيبقى الإجمالي = الأرضية بالضبط.
 */
export function applyPriceFloorPerDay(
  discountedPricePerDayExclTax: number,
  basePricePerDayExclTax: number,
  floor: ResolvedPriceFloor,
  periodKind: RentalPeriodKind,
  days: number,
): PriceFloorOutcome {
  const d = Math.max(1, Math.round(days));
  const base = Math.max(0, basePricePerDayExclTax);
  const discounted = Math.max(0, discountedPricePerDayExclTax);

  const rawFloor =
    periodKind === "MONTHLY"
      ? floor.minPriceMonthlyExclTax != null
        ? floor.minPriceMonthlyExclTax / d
        : null
      : floor.minPricePerDayExclTax;

  if (rawFloor == null || rawFloor <= 0) {
    return {
      finalPricePerDayExclTax: discounted,
      discountedPricePerDayExclTax: discounted,
      basePricePerDayExclTax: base,
      floorPerDayExclTax: null,
      floorApplied: false,
      withheldDiscountExclTax: 0,
      floorExceedsBasePrice: false,
      periodKind,
    };
  }

  const floorPerDay = rawFloor;
  const floorExceedsBasePrice = floorPerDay > base;
  const finalPerDay = Math.min(base, Math.max(discounted, floorPerDay));
  // الأرضية «طبَّقت» فقط لو رفعت السعر فعلياً فوق سعر ما بعد الخصم.
  const floorApplied = finalPerDay > discounted;

  return {
    finalPricePerDayExclTax: round2(finalPerDay),
    discountedPricePerDayExclTax: round2(discounted),
    basePricePerDayExclTax: round2(base),
    floorPerDayExclTax: round2(floorPerDay),
    floorApplied,
    withheldDiscountExclTax: floorApplied ? round2((finalPerDay - discounted) * d) : 0,
    floorExceedsBasePrice,
    periodKind,
  };
}

/**
 * سقف خصم كوبون `FULL_TOTAL` بحيث لا ينزل المتبقي تحت أرضية الإيجار.
 *
 * الأرضية تحمي بند الإيجار فقط (قرار إداري): الإضافات والرسوم قابلة للخصم
 * بالكامل، لكن الإجمالي الفرعي لا ينزل تحت `floorPerDay × الأيام`.
 */
export function capFullTotalDiscountToFloor(
  requestedDiscountExclTax: number,
  subtotalExclTax: number,
  floorPerDayExclTax: number | null,
  days: number,
): { discountExclTax: number; floorApplied: boolean; withheldDiscountExclTax: number } {
  const requested = Math.max(0, requestedDiscountExclTax);
  if (floorPerDayExclTax == null || floorPerDayExclTax <= 0) {
    return { discountExclTax: requested, floorApplied: false, withheldDiscountExclTax: 0 };
  }
  const d = Math.max(1, Math.round(days));
  const floorTotal = floorPerDayExclTax * d;
  const maxDiscount = Math.max(0, subtotalExclTax - floorTotal);
  if (requested <= maxDiscount) {
    return { discountExclTax: requested, floorApplied: false, withheldDiscountExclTax: 0 };
  }
  return {
    discountExclTax: round2(maxDiscount),
    floorApplied: true,
    withheldDiscountExclTax: round2(requested - maxDiscount),
  };
}
