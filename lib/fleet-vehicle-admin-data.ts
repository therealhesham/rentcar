import type { FuelType, Transmission } from "@prisma/client";
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
  fuel: FuelType;
  transmission: Transmission;
  /** كمية فرع واحد أو المجموع */
  quantity: number;
  image: string | null;
};

export type AdminFleetVehicleSuperRow = AdminFleetVehicleListRow & {
  totalQuantity: number;
  /** كمية لكل فرع نشط (بالترتيب) */
  branchQuantities: { branchId: number; quantity: number }[];
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
    return {
      id: r.id,
      brandName: r.brand.name.trim(),
      modelName: r.name.trim(),
      categoryId: r.category.id,
      categoryTitle: r.category.title.trim(),
      year: r.year,
      chairs: r.chairs,
      price: r.price,
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

/** سوبر أدمن: كل الموديلات + كمية كل فرع */
export async function listFleetVehiclesForSuperAdmin(): Promise<{
  branches: AdminFleetBranchColumn[];
  categories: { id: number; title: string }[];
  vehicles: AdminFleetVehicleSuperRow[];
}> {
  const branches = await prisma.branch.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    select: { id: true, name: true, slug: true },
  });

  const rows = await prisma.carModel.findMany({
    orderBy: [{ brand: { name: "asc" } }, { name: "asc" }, { year: "desc" }],
    include: {
      brand: true,
      category: { select: { id: true, title: true } },
      fleetItems: { select: { branchId: true, quantity: true } },
    },
  });

  const qtyByBranchId = (items: { branchId: number; quantity: number }[], branchId: number) =>
    items.find((f) => f.branchId === branchId)?.quantity ?? 0;

  const vehicles: AdminFleetVehicleSuperRow[] = rows.map((r) => {
    const branchQuantities = branches.map((b) => ({
      branchId: b.id,
      quantity: qtyByBranchId(r.fleetItems, b.id),
    }));
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
  year: number;
  chairs: number;
  engine: string;
  transmission: Transmission;
  fuel: FuelType;
  price: number;
  vatRatePercent: number;
  quantity: number;
  image: string | null;
  alt: string | null;
  badge: string | null;
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
    year: row.year,
    chairs: row.chairs,
    engine: row.engine.trim(),
    transmission: row.transmission,
    fuel: row.fuel,
    price: row.price,
    vatRatePercent: row.vatRatePercent,
    quantity: totalQty,
    image: row.image?.trim() || null,
    alt: row.alt?.trim() || null,
    badge: row.badge?.trim() || null,
    branchFleet: row.fleetItems.map((f) => ({
      branchId: f.branchId,
      branchName: f.branch.name,
      quantity: f.quantity,
    })),
  };
}
