import type { FuelType, Transmission } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { FleetCar } from "@/lib/fleet-types";
import { buildFleetCardPriceParts, type RentalPriceDisplayMode } from "@/lib/pricing";
import { getRentalPriceDisplayMode } from "@/lib/site-settings";

const FUEL_AR: Record<FuelType, string> = {
  GASOLINE: "بنزين",
  DIESEL: "ديزل",
  HYBRID: "هجين",
  ELECTRIC: "كهرباء",
};

const TRANS_AR: Record<Transmission, string> = {
  MANUAL: "يدوي",
  AUTOMATIC: "أوتوماتيك",
};

const PLACEHOLDER_IMG =
  "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1200&q=80";

const fleetModelInclude = {
  model: {
    include: { brand: true, category: true },
  },
} as const;

type FleetRowWithModel = Awaited<
  ReturnType<
    typeof prisma.fleet.findMany<{ include: typeof fleetModelInclude }>
  >
>[number];

function mapFleetRowToFleetCar(
  row: FleetRowWithModel,
  priceMode: RentalPriceDisplayMode,
): FleetCar {
  const m = row.model;
  const brandName = m.brand.name.trim();
  const modelName = m.name.trim();
  const fullTitle = `${brandName} ${modelName}`.trim();
  const subtitle = `${m.year} • ${FUEL_AR[m.fuel]} • ${TRANS_AR[m.transmission]}`;
  const priceUi = buildFleetCardPriceParts(m.price, m.vatRatePercent, priceMode);
  /** غير مخزّن في قاعدة البيانات — تقدير بسيط للعرض حسب حجم المركبة */
  const displayDoors = m.chairs >= 7 ? 5 : 4;
  const displayLuggage = m.chairs >= 7 ? 4 : m.chairs >= 6 ? 3 : 2;

  return {
    id: row.id,
    modelId: row.modelId,
    brand: brandName,
    name: modelName,
    year: m.year,
    fullTitle,
    subtitle,
    priceUi,
    image: m.image?.trim() || PLACEHOLDER_IMG,
    alt: m.alt?.trim() || fullTitle,
    badge: m.badge,
    specs: [
      { icon: "door_open", value: String(displayDoors) },
      { icon: "airline_seat_recline_extra", value: String(m.chairs) },
      { icon: "luggage", value: String(displayLuggage) },
    ],
  };
}

/** صف واحد لكل `modelId` (أحدث `Fleet.id`) — للصفحة الرئيسية ومقارنات الموديل */
export async function getFleetCarMapByModelIds(
  modelIds: number[],
  priceDisplayMode?: RentalPriceDisplayMode,
): Promise<Map<number, FleetCar>> {
  const map = new Map<number, FleetCar>();
  const unique = [...new Set(modelIds.filter((id) => Number.isFinite(id)))];
  if (unique.length === 0) return map;

  const priceMode = priceDisplayMode ?? (await getRentalPriceDisplayMode());

  const rows = await prisma.fleet.findMany({
    where: {
      quantity: { gt: 0 },
      modelId: { in: unique },
    },
    include: fleetModelInclude,
    orderBy: { id: "desc" },
  });

  for (const row of rows) {
    if (map.has(row.modelId)) continue;
    map.set(row.modelId, mapFleetRowToFleetCar(row, priceMode));
  }

  return map;
}

export async function getFleetCarsForDisplay(
  categorySlug?: string | null,
  modelIds?: number[] | null,
  priceDisplayMode?: RentalPriceDisplayMode,
): Promise<FleetCar[]> {
  const idFilter =
    modelIds && modelIds.length > 0 ? { modelId: { in: modelIds } } : {};

  const priceMode = priceDisplayMode ?? (await getRentalPriceDisplayMode());

  const rows = await prisma.fleet.findMany({
    where: {
      quantity: { gt: 0 },
      ...idFilter,
      ...(categorySlug
        ? {
            model: {
              category: { slug: categorySlug },
            },
          }
        : {}),
    },
    include: fleetModelInclude,
    orderBy: { id: "desc" },
  });

  return rows.map((row) => mapFleetRowToFleetCar(row, priceMode));
}
