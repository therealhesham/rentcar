import type { FuelType, Transmission } from "@prisma/client";
import { branchWhereForScope, type AdminScope } from "@/lib/admin-scope";
import { prisma } from "@/lib/prisma";

export type AdminFleetBranchColumn = {
  id: number;
  name: string;
  slug: string;
};

export type AdminFleetVehicleListRow = {
  id: number;
  brandName: string;
  modelName: string;
  categoryId: number;
  categoryTitle: string;
  year: number;
  chairs: number;
  price: number;
  /** السعر الشهري الأساسي للموديل — null = لا يوجد عرض شهري */
  priceMonthlyExclTax: number | null;
  /** الحد الأدنى للسعر اليومي دون ضريبة — null = بلا حد. */
  minPricePerDayExclTax: number | null;
  /** الحد الأدنى للسعر الشهري دون ضريبة — null = بلا حد. */
  minPriceMonthlyExclTax: number | null;
  fuel: FuelType;
  transmission: Transmission;
  /** كمية فرع واحد أو المجموع */
  quantity: number;
  /** سعر خاص بفرع الموظف (null = سعر الموديل الأساسي) — لعرض موظف الفرع فقط */
  branchPricePerDayExclTax?: number | null;
  /** سعر شهري خاص بفرع الموظف (null = السعر الشهري الأساسي) — لعرض موظف الفرع فقط */
  branchPriceMonthlyExclTax?: number | null;
  /** حد أدنى يومي خاص بفرع الموظف (null = حد الموديل) — لعرض موظف الفرع فقط */
  branchMinPricePerDayExclTax?: number | null;
  /** حد أدنى شهري خاص بفرع الموظف (null = حد الموديل) — لعرض موظف الفرع فقط */
  branchMinPriceMonthlyExclTax?: number | null;
  image: string | null;
};

export type AdminFleetVehicleSuperRow = AdminFleetVehicleListRow & {
  totalQuantity: number;
  /** كمية وسعر خاص لكل فرع نشط (بالترتيب) — السعر null = سعر الموديل الأساسي */
  branchQuantities: {
    branchId: number;
    quantity: number;
    pricePerDayExclTax: number | null;
    priceMonthlyExclTax: number | null;
    minPricePerDayExclTax: number | null;
    minPriceMonthlyExclTax: number | null;
  }[];
};

/** مركبات الكتالوج مع كمية فرع موظف الفرع */
export async function listFleetVehiclesForAdmin(
  branchId?: number | null,
): Promise<{ categories: { id: number; title: string }[]; vehicles: AdminFleetVehicleListRow[] }> {
  const rows = await prisma.carModel.findMany({
    orderBy: [{ brand: { name: "asc" } }, { name: "asc" }, { year: "desc" }],
    include: {
      brand: true,
      category: { select: { id: true, title: true } },
      fleetItems: branchId
        ? { where: { branchId }, take: 1 }
        : { orderBy: { quantity: "desc" } },
    },
  });

  const mapped = rows.map((r) => {
    const qty = branchId
      ? (r.fleetItems[0]?.quantity ?? 0)
      : r.fleetItems.reduce((s, f) => s + f.quantity, 0);
    const branchPricePerDayExclTax = branchId
      ? (r.fleetItems[0]?.pricePerDayExclTax ?? null)
      : null;
    const branchPriceMonthlyExclTax = branchId
      ? (r.fleetItems[0]?.priceMonthlyExclTax ?? null)
      : null;
    const branchMinPricePerDayExclTax = branchId
      ? (r.fleetItems[0]?.minPricePerDayExclTax ?? null)
      : null;
    const branchMinPriceMonthlyExclTax = branchId
      ? (r.fleetItems[0]?.minPriceMonthlyExclTax ?? null)
      : null;
    return {
      branchPricePerDayExclTax,
      branchPriceMonthlyExclTax,
      branchMinPricePerDayExclTax,
      branchMinPriceMonthlyExclTax,
      id: r.id,
      brandName: r.brand.name.trim(),
      modelName: r.name.trim(),
      categoryId: r.category.id,
      categoryTitle: r.category.title.trim(),
      year: r.year,
      chairs: r.chairs,
      price: r.price,
      priceMonthlyExclTax: r.priceMonthlyExclTax,
      minPricePerDayExclTax: r.minPricePerDayExclTax,
      minPriceMonthlyExclTax: r.minPriceMonthlyExclTax,
      fuel: r.fuel,
      transmission: r.transmission,
      quantity: qty,
      image: r.image?.trim() || null,
    };
  });

  const categories = await prisma.fleetCategory.findMany({
    orderBy: { title: "asc" },
    select: { id: true, title: true },
  });

  return { categories, vehicles: mapped };
}

/** عرض متعدد الفروع: كل الموديلات + عمود كمية لكل فرع داخل النطاق (سوبر أدمن، إدارة مركزية، مشرف مدينة). */
export async function listFleetVehiclesAcrossBranches(
  scope: AdminScope,
): Promise<{
  branches: AdminFleetBranchColumn[];
  categories: { id: number; title: string }[];
  vehicles: AdminFleetVehicleSuperRow[];
}> {
  const branches = await prisma.branch.findMany({
    where: { ...branchWhereForScope(scope), isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true },
  });

  const rows = await prisma.carModel.findMany({
    orderBy: [{ brand: { name: "asc" } }, { name: "asc" }, { year: "desc" }],
    include: {
      brand: true,
      category: { select: { id: true, title: true } },
      fleetItems: {
        select: {
          branchId: true,
          quantity: true,
          pricePerDayExclTax: true,
          priceMonthlyExclTax: true,
          minPricePerDayExclTax: true,
          minPriceMonthlyExclTax: true,
        },
      },
    },
  });

  const vehicles: AdminFleetVehicleSuperRow[] = rows.map((r) => {
    const branchQuantities = branches.map((b) => {
      const item = r.fleetItems.find((f) => f.branchId === b.id);
      return {
        branchId: b.id,
        quantity: item?.quantity ?? 0,
        pricePerDayExclTax: item?.pricePerDayExclTax ?? null,
        priceMonthlyExclTax: item?.priceMonthlyExclTax ?? null,
        minPricePerDayExclTax: item?.minPricePerDayExclTax ?? null,
        minPriceMonthlyExclTax: item?.minPriceMonthlyExclTax ?? null,
      };
    });
    const totalQuantity = branchQuantities.reduce((s, x) => s + x.quantity, 0);
    return {
      id: r.id,
      brandName: r.brand.name.trim(),
      modelName: r.name.trim(),
      categoryId: r.category.id,
      categoryTitle: r.category.title.trim(),
      year: r.year,
      chairs: r.chairs,
      price: r.price,
      priceMonthlyExclTax: r.priceMonthlyExclTax,
      minPricePerDayExclTax: r.minPricePerDayExclTax,
      minPriceMonthlyExclTax: r.minPriceMonthlyExclTax,
      fuel: r.fuel,
      transmission: r.transmission,
      quantity: totalQuantity,
      totalQuantity,
      image: r.image?.trim() || null,
      branchQuantities,
    };
  });

  const categories = await prisma.fleetCategory.findMany({
    orderBy: { title: "asc" },
    select: { id: true, title: true },
  });

  return { branches, categories, vehicles };
}

export type AdminFleetVehicleEditPayload = {
  id: number;
  brandId: number;
  brandName: string;
  categoryId: number;
  categoryTitle: string;
  name: string;
  nameEn: string | null;
  year: number;
  chairs: number;
  engine: string;
  transmission: Transmission;
  fuel: FuelType;
  price: number;
  /** السعر الشهري الأساسي دون ضريبة — null = لا يوجد عرض شهري لهذا الموديل. */
  priceMonthlyExclTax: number | null;
  vatRatePercent: number;
  /** الحد الأدنى للسعر اليومي دون ضريبة — null = بلا حد. */
  minPricePerDayExclTax: number | null;
  /** الحد الأدنى للسعر الشهري دون ضريبة — null = بلا حد. */
  minPriceMonthlyExclTax: number | null;
  quantity: number;
  image: string | null;
  alt: string | null;
  badge: string | null;
  badgeEn: string | null;
  cta: string | null;
  ctaEn: string | null;
  branchFleet: { branchId: number; branchName: string; quantity: number }[];
};

export async function getFleetVehicleForAdminEdit(
  modelId: number,
): Promise<AdminFleetVehicleEditPayload | null> {
  const row = await prisma.carModel.findUnique({
    where: { id: modelId },
    include: {
      brand: true,
      category: true,
      fleetItems: {
        include: { branch: { select: { id: true, name: true } } },
        orderBy: { branch: { sortOrder: "asc" } },
      },
    },
  });
  if (!row) return null;

  const totalQty = row.fleetItems.reduce((s, f) => s + f.quantity, 0);

  return {
    id: row.id,
    brandId: row.brandId,
    brandName: row.brand.name.trim(),
    categoryId: row.categoryId,
    categoryTitle: row.category.title.trim(),
    name: row.name.trim(),
    nameEn: row.nameEn?.trim() || null,
    year: row.year,
    chairs: row.chairs,
    engine: row.engine.trim(),
    transmission: row.transmission,
    fuel: row.fuel,
    price: row.price,
    priceMonthlyExclTax: row.priceMonthlyExclTax,
    vatRatePercent: row.vatRatePercent,
    minPricePerDayExclTax: row.minPricePerDayExclTax,
    minPriceMonthlyExclTax: row.minPriceMonthlyExclTax,
    quantity: totalQty,
    image: row.image?.trim() || null,
    alt: row.alt?.trim() || null,
    badge: row.badge?.trim() || null,
    badgeEn: row.badgeEn?.trim() || null,
    cta: row.cta?.trim() || null,
    ctaEn: row.ctaEn?.trim() || null,
    branchFleet: row.fleetItems.map((f) => ({
      branchId: f.branchId,
      branchName: f.branch.name,
      quantity: f.quantity,
    })),
  };
}
