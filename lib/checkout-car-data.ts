import { prisma } from "@/lib/prisma";

const PLACEHOLDER_IMG =
  "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1200&q=80";

export type CheckoutCarDTO = {
  modelId: number;
  brand: string;
  name: string;
  year: number;
  fullTitle: string;
  categoryTitle: string;
  pricePerDayExclTax: number;
  vatRatePercent: number;
  image: string;
  alt: string;
};

/** سيارة متوفرة في الأسطول (كمية > 0) لصفحة إتمام الحجز */
export async function getCarModelForCheckout(modelId: number): Promise<CheckoutCarDTO | null> {
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

  const brandName = m.brand.name.trim();
  const modelName = m.name.trim();

  return {
    modelId: m.id,
    brand: brandName,
    name: modelName,
    year: m.year,
    fullTitle: `${brandName} ${modelName}`.trim(),
    categoryTitle: m.category.title.trim(),
    pricePerDayExclTax: m.price,
    vatRatePercent: m.vatRatePercent,
    image: m.image?.trim() || PLACEHOLDER_IMG,
    alt: m.alt?.trim() || `${brandName} ${modelName}`,
  };
}
