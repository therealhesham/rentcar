import type { FuelType, Transmission } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { FleetCar } from "@/lib/fleet-types";
import { buildFleetCardPriceParts, type RentalPriceDisplayMode } from "@/lib/pricing";
import { fleetWhereForBranchSlug } from "@/lib/fleet-branch-stock";
import { getRentalPriceDisplayMode } from "@/lib/site-settings";
import {
  getActiveRentalDiscounts,
  resolveBestRentalDiscount,
  customerDiscountLabelForActualSavings,
  type RentalDiscountRule,
} from "@/lib/rental-discount";
import { applyPriceFloorPerDay, type ResolvedPriceFloor } from "@/lib/min-price-floor";

const FUEL_AR: Record<FuelType, string> = {
  GASOLINE: "بنزين",
  DIESEL: "ديزل",
  HYBRID: "هجين",
  ELECTRIC: "كهرباء",
};

const FUEL_EN: Record<FuelType, string> = {
  GASOLINE: "Gasoline",
  DIESEL: "Diesel",
  HYBRID: "Hybrid",
  ELECTRIC: "Electric",
};

const TRANS_AR: Record<Transmission, string> = {
  MANUAL: "يدوي",
  AUTOMATIC: "أوتوماتيك",
};

const TRANS_EN: Record<Transmission, string> = {
  MANUAL: "Manual",
  AUTOMATIC: "Automatic",
};

const PLACEHOLDER_IMG =
  "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1200&q=80";

import { localizeDbField } from "@/lib/localize";

const fleetModelInclude = {
  model: {
    include: { brand: true, category: true },
  },
  branch: { select: { slug: true } },
} as const;

type FleetRowWithModel = Awaited<
  ReturnType<
    typeof prisma.fleet.findMany<{ include: typeof fleetModelInclude }>
  >
>[number];

/** السعر الأساسي للصف: تجاوز الفرع إن وُجد وإلا سعر الموديل. */
function rowBasePrice(row: FleetRowWithModel): number {
  return row.pricePerDayExclTax ?? row.model.price;
}

/** أرضية السعر الأدنى للصف: تجاوز الفرع إن وُجد وإلا حد الموديل. */
function rowPriceFloor(row: FleetRowWithModel): ResolvedPriceFloor {
  return {
    minPricePerDayExclTax:
      row.minPricePerDayExclTax ?? row.model.minPricePerDayExclTax,
    minPriceMonthlyExclTax:
      row.minPriceMonthlyExclTax ?? row.model.minPriceMonthlyExclTax,
  };
}

/**
 * السعر اليومي المعروض للصف بعد الخصم والأرضية — الأرضية تُطبَّق هنا كذلك
 * حتى لا تعرض بطاقة الأسطول سعراً أقل مما سيدفعه العميل في صفحة الإتمام.
 */
function rowDiscountedPrice(
  row: FleetRowWithModel,
  discountRules: ReadonlyArray<RentalDiscountRule>,
  referenceDate?: Date | null,
): { basePrice: number; effectivePrice: number; displayLabelAr: string | null } {
  const basePrice = rowBasePrice(row);
  const priceFloor = rowPriceFloor(row);
  const resolved = resolveBestRentalDiscount(
    discountRules,
    {
      brandId: row.model.brandId,
      carModelId: row.model.id,
      branchId: row.branchId,
      referenceDate,
      priceFloor,
    },
    basePrice,
  );
  const effectivePrice = applyPriceFloorPerDay(
    resolved?.discountedPricePerDayExclTax ?? basePrice,
    basePrice,
    priceFloor,
    "DAILY",
    1,
  ).finalPricePerDayExclTax;
  return {
    basePrice,
    effectivePrice,
    // الشارة تعكس التوفير الفعلي بعد الأرضية — مش الخصم النظري قبلها.
    displayLabelAr: customerDiscountLabelForActualSavings(resolved, basePrice - effectivePrice),
  };
}

/** السعر الفعلي للصف بعد الخصم (لاختيار أرخص فرع للعرض). */
function rowEffectivePrice(
  row: FleetRowWithModel,
  discountRules: ReadonlyArray<RentalDiscountRule>,
  referenceDate?: Date | null,
): number {
  return rowDiscountedPrice(row, discountRules, referenceDate).effectivePrice;
}

/** السعر الشهري للصف: تجاوز الفرع إن وُجد وإلا سعر الموديل الشهري. null = لا يوجد عرض شهري. */
function rowMonthlyPrice(row: FleetRowWithModel): number | null {
  return row.priceMonthlyExclTax ?? row.model.priceMonthlyExclTax;
}

function mapFleetRowToFleetCar(
  row: FleetRowWithModel,
  priceMode: RentalPriceDisplayMode,
  discountRules: ReadonlyArray<RentalDiscountRule>,
  referenceDate?: Date | null,
  locale: string = "ar",
  startingFrom: boolean = false,
  monthlyOverride?: { price: number; varies: boolean } | null,
  availableBranchSlugs?: string[],
): FleetCar {
  const m = row.model;
  const brandName = localizeDbField(m.brand, "name", locale).trim();
  const modelName = localizeDbField(m, "name", locale).trim();
  const fullTitle = `${brandName} ${modelName}`.trim();
  const fuelText = locale === "en" ? FUEL_EN[m.fuel] : FUEL_AR[m.fuel];
  const transText = locale === "en" ? TRANS_EN[m.transmission] : TRANS_AR[m.transmission];
  const subtitle = `${m.year} • ${fuelText} • ${transText}`;

  let priceUi;
  if (monthlyOverride) {
    // السعر الشهري رقم مستقل ومسعّر مسبقاً — لا يمر بنظام خصومات السعر اليومي
    priceUi = buildFleetCardPriceParts(monthlyOverride.price, m.vatRatePercent, priceMode, {
      startingFrom: monthlyOverride.varies,
      periodLabelAr: "شهرياً",
      periodLabelEn: "Monthly",
      locale,
    });
  } else {
    const { basePrice, effectivePrice, displayLabelAr } = rowDiscountedPrice(
      row,
      discountRules,
      referenceDate,
    );
    priceUi = buildFleetCardPriceParts(effectivePrice, m.vatRatePercent, priceMode, {
      originalPriceExclTaxSar: basePrice,
      discountLabelAr: displayLabelAr,
      discountLabelEn: displayLabelAr,
      startingFrom,
      locale,
    });
  }
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
    badge: localizeDbField(m, "badge", locale),
    specs: [
      { icon: "door_open", value: String(displayDoors) },
      { icon: "airline_seat_recline_extra", value: String(m.chairs) },
      { icon: "luggage", value: String(displayLuggage) },
    ],
    availableBranchSlugs,
  };
}

/** صف واحد لكل `modelId` (أحدث `Fleet.id`) — للصفحة الرئيسية ومقارنات الموديل */
export async function getFleetCarMapByModelIds(
  modelIds: number[],
  priceDisplayMode?: RentalPriceDisplayMode,
  opts?: { branchId?: number | null; referenceDate?: Date | null; locale?: string },
): Promise<Map<number, FleetCar>> {
  const map = new Map<number, FleetCar>();
  const unique = [...new Set(modelIds.filter((id) => Number.isFinite(id)))];
  if (unique.length === 0) return map;

  const [priceMode, discountRules] = await Promise.all([
    priceDisplayMode ?? getRentalPriceDisplayMode(),
    getActiveRentalDiscounts(),
  ]);

  const rows = await prisma.fleet.findMany({
    where: {
      isVisible: true,
      quantity: { gt: 0 },
      modelId: { in: unique },
      ...(opts?.branchId != null ? { branchId: opts.branchId } : {}),
      branch: { isActive: true },
    },
    include: fleetModelInclude,
    orderBy: [{ model: { displayOrder: "asc" } }, { id: "asc" }],
  });

  const availableSlugsMap = new Map<number, string[]>();
  for (const r of rows) {
    if (r.quantity > 0 && r.branch?.slug) {
      const list = availableSlugsMap.get(r.modelId) ?? [];
      if (!list.includes(r.branch.slug)) list.push(r.branch.slug);
      availableSlugsMap.set(r.modelId, list);
    }
  }

  for (const [modelId, pick] of pickCheapestRowPerModel(
    rows,
    discountRules,
    opts?.referenceDate,
  )) {
    map.set(
      modelId,
      mapFleetRowToFleetCar(
        pick.row,
        priceMode,
        discountRules,
        opts?.referenceDate,
        opts?.locale,
        opts?.branchId == null && pick.pricesVary,
        null,
        availableSlugsMap.get(modelId),
      ),
    );
  }

  return map;
}

/**
 * يختار لكل موديل صف الفرع الأرخص (بعد الخصم) ويحدد ما إذا كان السعر يختلف
 * بين الفروع — لعرض «يبدأ من» قبل اختيار الفرع.
 */
function pickCheapestRowPerModel(
  rows: FleetRowWithModel[],
  discountRules: ReadonlyArray<RentalDiscountRule>,
  referenceDate?: Date | null,
): Map<number, { row: FleetRowWithModel; pricesVary: boolean }> {
  const byModel = new Map<
    number,
    { row: FleetRowWithModel; price: number; prices: Set<number> }
  >();
  for (const row of rows) {
    const price = rowEffectivePrice(row, discountRules, referenceDate);
    // فروق أقل من ريال غير مرئية بعد تقريب العرض — لا تستحق «يبدأ من»
    const displayPrice = Math.round(price);
    const cur = byModel.get(row.modelId);
    if (!cur) {
      byModel.set(row.modelId, { row, price, prices: new Set([displayPrice]) });
    } else {
      cur.prices.add(displayPrice);
      if (price < cur.price) {
        cur.row = row;
        cur.price = price;
      }
    }
  }
  const out = new Map<number, { row: FleetRowWithModel; pricesVary: boolean }>();
  for (const [modelId, v] of byModel) {
    out.set(modelId, { row: v.row, pricesVary: v.prices.size > 1 });
  }
  return out;
}

/**
 * أدنى سعر شهري لكل موديل (فقط من الفروع التي لها سعر شهري)، وهل يختلف بين الفروع.
 * موديل بدون أي سعر شهري لا يظهر في الخريطة — يبقى على السعر اليومي كما هو.
 */
function buildMonthlyPriceMap(
  rows: FleetRowWithModel[],
): Map<number, { price: number; varies: boolean }> {
  const byModel = new Map<number, { price: number; prices: Set<number> }>();
  for (const row of rows) {
    const monthly = rowMonthlyPrice(row);
    if (monthly == null) continue;
    const displayPrice = Math.round(monthly);
    const cur = byModel.get(row.modelId);
    if (!cur) {
      byModel.set(row.modelId, { price: displayPrice, prices: new Set([displayPrice]) });
    } else {
      cur.prices.add(displayPrice);
      if (displayPrice < cur.price) cur.price = displayPrice;
    }
  }
  const out = new Map<number, { price: number; varies: boolean }>();
  for (const [modelId, v] of byModel) {
    out.set(modelId, { price: v.price, varies: v.prices.size > 1 });
  }
  return out;
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
  /** تاريخ الاستلام لتطبيق خصومات الفترة */
  pickupDate?: Date | null;
  priceDisplayMode?: RentalPriceDisplayMode;
  locale?: string;
  /** "monthly" = عرض السعر الشهري بدل اليومي للموديلات التي لها سعر شهري */
  rentalTab?: string | null;
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
    pickupDate,
    priceDisplayMode: priceDisplayModeIn,
    locale = "ar",
    rentalTab,
  } = filters;

  const [priceMode, discountRules] = await Promise.all([
    priceDisplayModeIn ?? getRentalPriceDisplayMode(),
    getActiveRentalDiscounts(),
  ]);

  const modelWhere =
    categorySlug || brandId != null
      ? {
          model: {
            ...(categorySlug ? { category: { slug: categorySlug } } : {}),
            ...(brandId != null ? { brandId } : {}),
          },
        }
      : {};

  // فلتر الحد الأقصى للسعر: سعر الفرع إن وُجد وإلا سعر الموديل (COALESCE).
  const maxPriceWhere =
    maxPriceExclTax != null
      ? {
          OR: [
            { pricePerDayExclTax: { lte: maxPriceExclTax } },
            {
              pricePerDayExclTax: null,
              model: { price: { lte: maxPriceExclTax } },
            },
          ],
        }
      : {};

  const branchFilter = branchSlug?.trim()
    ? fleetWhereForBranchSlug(branchSlug)
    : { quantity: { gt: 0 } as const, branch: { isActive: true } };

  const rows = await prisma.fleet.findMany({
    where: {
      isVisible: true,
      ...branchFilter,
      ...(modelIds !== undefined && modelIds !== null
        ? { modelId: { in: modelIds } }
        : {}),
      ...modelWhere,
      ...maxPriceWhere,
    },
    include: fleetModelInclude,
    orderBy: [{ model: { displayOrder: "asc" } }, { id: "asc" }],
  });

  const hasBranchFilter = Boolean(branchSlug?.trim());
  const isMonthlyTab = rentalTab?.trim().toLowerCase() === "monthly";
  const cars: FleetCar[] = [];
  const orderSeen: number[] = [];
  const picks = pickCheapestRowPerModel(rows, discountRules, pickupDate);
  const monthlyPrices = isMonthlyTab ? buildMonthlyPriceMap(rows) : null;
  const seenModelIds = new Set<number>();
  for (const row of rows) {
    if (seenModelIds.has(row.modelId)) continue;
    seenModelIds.add(row.modelId);
    orderSeen.push(row.modelId);
  }
  const availableSlugsRows = await prisma.fleet.findMany({
    where: {
      modelId: { in: orderSeen },
      quantity: { gt: 0 },
      branch: { isActive: true },
    },
    select: { modelId: true, branch: { select: { slug: true } } },
  });
  const availableSlugsMap = new Map<number, string[]>();
  for (const r of availableSlugsRows) {
    if (r.branch?.slug) {
      const list = availableSlugsMap.get(r.modelId) ?? [];
      if (!list.includes(r.branch.slug)) list.push(r.branch.slug);
      availableSlugsMap.set(r.modelId, list);
    }
  }

  for (const modelId of orderSeen) {
    const pick = picks.get(modelId);
    if (!pick) continue;
    const monthly = monthlyPrices?.get(modelId);
    cars.push(
      mapFleetRowToFleetCar(
        pick.row,
        priceMode,
        discountRules,
        pickupDate,
        locale,
        !hasBranchFilter && pick.pricesVary,
        monthly ? { price: monthly.price, varies: !hasBranchFilter && monthly.varies } : null,
        availableSlugsMap.get(modelId),
      ),
    );
  }
  return cars;
}

export type FleetCategoryFilterOption = { slug: string; title: string };
export type FleetBrandFilterOption = { id: number; name: string };
export type FleetPriceBounds = { min: number; max: number };

/** تصنيفات الأسطول للفلاتر (ترتيب لوحة الإدارة) */
export async function getFleetCategoriesForFilter(locale: string = "ar"): Promise<FleetCategoryFilterOption[]> {
  const cats = await prisma.fleetCategory.findMany({
    orderBy: { sortOrder: "asc" },
    select: { slug: true, title: true, titleEn: true },
  });
  return cats.map((c) => ({
    slug: c.slug,
    title: localizeDbField(c, "title", locale),
  }));
}

/** ماركات لها مركبات متاحة في الأسطول */
export async function getFleetBrandsForFilter(locale: string = "ar"): Promise<FleetBrandFilterOption[]> {
  const brands = await prisma.brand.findMany({
    where: {
      models: {
        some: { fleetItems: { some: { quantity: { gt: 0 } } } },
      },
    },
    select: { id: true, name: true, nameEn: true },
  });
  const mapped = brands.map((b) => ({
    id: b.id,
    name: localizeDbField(b, "name", locale),
  }));
  mapped.sort((a, b) => a.name.localeCompare(b.name, locale));
  return mapped;
}

/** أدنى وأعلى سعر يومي (دون ضريبة) للمركبات المعروضة — يراعي تجاوزات أسعار الفروع. */
export async function getFleetPriceBounds(): Promise<FleetPriceBounds> {
  // COALESCE(سعر الفرع, سعر الموديل) على صفوف الأسطول المتاحة في فروع نشطة.
  const rows = await prisma.$queryRaw<{ minPrice: number | null; maxPrice: number | null }[]>`
    SELECT
      MIN(COALESCE(f.pricePerDayExclTax, m.price)) AS minPrice,
      MAX(COALESCE(f.pricePerDayExclTax, m.price)) AS maxPrice
    FROM Fleet f
    JOIN CarModel m ON m.id = f.modelId
    JOIN Branch b ON b.id = f.branchId
    WHERE f.quantity > 0 AND b.isActive = true
  `;
  const min = Number(rows[0]?.minPrice ?? 0);
  const max = Number(rows[0]?.maxPrice ?? 5000);
  return {
    min: Math.max(0, Math.floor(min)),
    max: Math.max(min, Math.ceil(max)),
  };
}
