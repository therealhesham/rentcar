import { prisma } from "@/lib/prisma";
import {
  minBranchBasePriceForModel,
  minBranchMonthlyPriceForModel,
  resolveBranchBasePriceForModel,
  resolveBranchMonthlyPriceForModel,
} from "@/lib/fleet-branch-stock";
import { resolveRentalDiscountForModel } from "@/lib/rental-discount";
import { applyPriceFloorPerDay, resolvePriceFloorForModel } from "@/lib/min-price-floor";

const PLACEHOLDER_IMG =
  "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1200&q=80";

export type CheckoutCarDTO = {
  modelId: number;
  brandId: number;
  brand: string;
  name: string;
  year: number;
  fullTitle: string;
  categoryTitle: string;
  /** السعر اليومي الفعلي (بعد الخصم إن وُجد) */
  pricePerDayExclTax: number;
  /** السعر الأصلي قبل الخصم */
  originalPricePerDayExclTax: number;
  /** وفّرت X ر.س أو خصم X٪ — للعرض فقط */
  discountLabelAr: string | null;
  /** سعر الإيجار الشهري الأساسي دون ضريبة (عرض إعلامي فقط حالياً) — null = لا يوجد عرض شهري لهذا الموديل. */
  pricePerMonthExclTax: number | null;
  vatRatePercent: number;
  image: string;
  alt: string;
};

export type CheckoutCarLoadOpts = {
  branchSlug?: string | null;
  pickupDate?: Date | null;
};

/** سيارة متوفرة في الأسطول (كمية > 0) لصفحة إتمام الحجز */
export async function getCarModelForCheckout(
  modelId: number,
  opts: CheckoutCarLoadOpts = {},
): Promise<CheckoutCarDTO | null> {
  if (!Number.isInteger(modelId) || modelId < 1) return null;

  const m = await prisma.carModel.findUnique({
    where: { id: modelId },
    include: { brand: true, category: true },
  });
  if (!m) return null;

  const agg = await prisma.fleet.aggregate({
    where: { modelId },
    _sum: { quantity: true },
  });
  const qty = agg._sum.quantity ?? 0;
  if (qty <= 0) return null;

  let branchId: number | null = null;
  const branchSlug = opts.branchSlug?.trim().toLowerCase();
  if (branchSlug) {
    const branch = await prisma.branch.findFirst({
      where: { slug: branchSlug, isActive: true },
      select: { id: true },
    });
    branchId = branch?.id ?? null;
  }

  // سعر الفرع المحدّد إن وُجد، وإلا أدنى سعر بين الفروع المتاحة (متوافق مع «يبدأ من» في الأسطول)
  const basePrice = branchId
    ? await resolveBranchBasePriceForModel(m.id, branchId, m.price)
    : (await minBranchBasePriceForModel(m.id, m.price)).minPrice;

  const monthlyPrice = branchId
    ? await resolveBranchMonthlyPriceForModel(m.id, branchId, m.priceMonthlyExclTax)
    : (await minBranchMonthlyPriceForModel(m.id, m.priceMonthlyExclTax)).minPrice;

  const resolved = await resolveRentalDiscountForModel(basePrice, {
    brandId: m.brandId,
    carModelId: m.id,
    branchId,
    referenceDate: opts.pickupDate ?? null,
  });

  const brandName = m.brand.name.trim();
  const modelName = m.name.trim();
  // أرضية السعر الأدنى تُطبَّق هنا كذلك — السعر المعروض في صفحة الإتمام لازم
  // يطابق اللي هيتحسب وقت الحجز في `createDirectBooking`.
  const priceFloor = await resolvePriceFloorForModel(m.id, branchId, {
    minPricePerDayExclTax: m.minPricePerDayExclTax,
    minPriceMonthlyExclTax: m.minPriceMonthlyExclTax,
  });
  const floorOutcome = applyPriceFloorPerDay(
    resolved?.discountedPricePerDayExclTax ?? basePrice,
    basePrice,
    priceFloor,
    "DAILY",
    1,
  );
  const effectivePrice = floorOutcome.finalPricePerDayExclTax;
  // لو الأرضية بلعت الخصم بالكامل، ما نعرضش شارة خصم كاذبة.
  const showDiscount = effectivePrice < basePrice;

  return {
    modelId: m.id,
    brandId: m.brandId,
    brand: brandName,
    name: modelName,
    year: m.year,
    fullTitle: `${brandName} ${modelName}`.trim(),
    categoryTitle: m.category.title.trim(),
    pricePerDayExclTax: effectivePrice,
    originalPricePerDayExclTax: basePrice,
    discountLabelAr: showDiscount ? (resolved?.displayLabelAr ?? null) : null,
    pricePerMonthExclTax: monthlyPrice,
    vatRatePercent: m.vatRatePercent,
    image: m.image?.trim() || PLACEHOLDER_IMG,
    alt: m.alt?.trim() || `${brandName} ${modelName}`,
  };
}
