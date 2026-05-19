import type { FuelType, Transmission } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { FleetCar } from "@/lib/fleet-types";
import { buildFleetCardPriceParts, type RentalPriceDisplayMode } from "@/lib/pricing";
import { fleetWhereForBranchSlug } from "@/lib/fleet-branch-stock";
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

export type FleetDisplayFilters = {
  categorySlug?: string | null;
  brandId?: number | null;
  /** حد أقصى للسعر اليومي دون ضريبة (`CarModel.price`) */
  maxPriceExclTax?: number | null;
  /** `undefined` = بدون فلترة توفر؛ `[]` = لا نتائج متاحة */
  modelIds?: number[] | null;
  /** فرع الإرجاع — عرض مركبات لها مخزون في هذا الفرع فقط */
  branchSlug?: string | null;
  priceDisplayMode?: RentalPriceDisplayMode;
};

export async function getFleetCarsForDisplay(
  filters: FleetDisplayFilters = {},
): Promise<FleetCar[]> {
  const {
    categorySlug,
    brandId,
    maxPriceExclTax,
    modelIds,
    branchSlug,
    priceDisplayMode: priceDisplayModeIn,
  } = filters;

  const priceMode = priceDisplayModeIn ?? (await getRentalPriceDisplayMode());

  const modelWhere =
    categorySlug || brandId != null || maxPriceExclTax != null
      ? {
          model: {
            ...(categorySlug ? { category: { slug: categorySlug } } : {}),
            ...(brandId != null ? { brandId } : {}),
            ...(maxPriceExclTax != null ? { price: { lte: maxPriceExclTax } } : {}),
          },
        }
      : {};

  const branchFilter = branchSlug?.trim()
    ? fleetWhereForBranchSlug(branchSlug)
    : { quantity: { gt: 0 } as const };

  const rows = await prisma.fleet.findMany({
    where: {
      ...branchFilter,
      ...(modelIds !== undefined && modelIds !== null
        ? { modelId: { in: modelIds } }
        : {}),
      ...modelWhere,
    },
    include: fleetModelInclude,
    orderBy: { id: "desc" },
  });

  const seenModelIds = new Set<number>();
  const cars: FleetCar[] = [];
  for (const row of rows) {
    if (seenModelIds.has(row.modelId)) continue;
    seenModelIds.add(row.modelId);
    cars.push(mapFleetRowToFleetCar(row, priceMode));
  }
  return cars;
}

export type FleetCategoryFilterOption = { slug: string; title: string };
export type FleetBrandFilterOption = { id: number; name: string };
export type FleetPriceBounds = { min: number; max: number };

/** تصنيفات الأسطول للفلاتر (ترتيب لوحة الإدارة) */
export async function getFleetCategoriesForFilter(): Promise<FleetCategoryFilterOption[]> {
  return prisma.fleetCategory.findMany({
    orderBy: { sortOrder: "asc" },
    select: { slug: true, title: true },
  });
}

/** ماركات لها مركبات متاحة في الأسطول */
export async function getFleetBrandsForFilter(): Promise<FleetBrandFilterOption[]> {
  return prisma.brand.findMany({
    where: {
      models: {
        some: { fleetItems: { some: { quantity: { gt: 0 } } } },
      },
    },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });
}

/** أدنى وأعلى سعر يومي (دون ضريبة) للمركبات المعروضة */
export async function getFleetPriceBounds(): Promise<FleetPriceBounds> {
  const agg = await prisma.carModel.aggregate({
    where: { fleetItems: { some: { quantity: { gt: 0 } } } },
    _min: { price: true },
    _max: { price: true },
  });
  const min = agg._min.price ?? 0;
  const max = agg._max.price ?? 5000;
  return {
    min: Math.max(0, min),
    max: Math.max(min, max),
  };
}
