import type { FuelType, Transmission } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getFleetCarMapByModelIds } from "@/lib/fleet-data";
import { localizeDbField } from "@/lib/localize";
import type { FleetCardPriceParts } from "@/lib/pricing";

const PLACEHOLDER_IMG =
  "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1200&q=80";

/** بيانات الصفحة الدعائية للسيارة — عامة بلا فرع ولا تواريخ، فتصلح للمشاركة على السوشيال. */
export type CarLandingDTO = {
  modelId: number;
  brand: string;
  name: string;
  year: number;
  fullTitle: string;
  categoryTitle: string;
  seats: number;
  engine: string;
  fuel: FuelType;
  transmission: Transmission;
  image: string;
  alt: string;
  badge: string | null;
  /** null = السيارة غير متاحة في أي فرع حالياً — الصفحة تظل تعمل لكن بلا سعر ولا حجز. */
  priceUi: FleetCardPriceParts | null;
};

export function parseCarLandingModelId(raw: string): number | null {
  if (!/^\d{1,9}$/.test(raw)) return null;
  const id = Number(raw);
  return id >= 1 ? id : null;
}

export async function getCarLandingData(
  modelId: number,
  locale: string,
): Promise<CarLandingDTO | null> {
  const [model, fleetMap] = await Promise.all([
    prisma.carModel.findUnique({
      where: { id: modelId },
      include: { brand: true, category: true },
    }),
    getFleetCarMapByModelIds([modelId], undefined, { locale }),
  ]);
  if (!model) return null;

  const brand = localizeDbField(model.brand, "name", locale).trim();
  const name = localizeDbField(model, "name", locale).trim();
  const fullTitle = `${brand} ${name}`.trim();
  const fleetCar = fleetMap.get(modelId);

  return {
    modelId: model.id,
    brand,
    name,
    year: model.year,
    fullTitle,
    categoryTitle: localizeDbField(model.category, "title", locale).trim(),
    seats: model.chairs,
    engine: model.engine.trim(),
    fuel: model.fuel,
    transmission: model.transmission,
    image: model.image?.trim() || PLACEHOLDER_IMG,
    alt: model.alt?.trim() || fullTitle,
    badge: localizeDbField(model, "badge", locale).trim() || null,
    priceUi: fleetCar?.priceUi ?? null,
  };
}

/** معرّفات الموديلات المتاحة فعلاً للحجز — لخريطة الموقع. */
export async function listBookableModelIds(): Promise<{ id: number; updatedAt: Date }[]> {
  const rows = await prisma.carModel.findMany({
    where: {
      fleetItems: { some: { isVisible: true, quantity: { gt: 0 }, branch: { isActive: true } } },
    },
    select: { id: true, updatedAt: true },
    orderBy: { displayOrder: "asc" },
  });
  return rows;
}
