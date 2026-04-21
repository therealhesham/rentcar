import type { FuelType, Transmission } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type AdminFleetVehicleListRow = {
  id: number;
  brandName: string;
  modelName: string;
  year: number;
  price: number;
  quantity: number;
  image: string | null;
};

/** مركبات لها سجل أسطول (للعرض والتعديل من الإدارة) */
export async function listFleetVehiclesForAdmin(): Promise<AdminFleetVehicleListRow[]> {
  const rows = await prisma.carModel.findMany({
    where: { fleetItems: { some: {} } },
    include: { brand: true, fleetItems: { orderBy: { id: "asc" }, take: 1 } },
    orderBy: [{ brand: { name: "asc" } }, { name: "asc" }, { year: "desc" }],
  });

  return rows.map((r) => ({
    id: r.id,
    brandName: r.brand.name.trim(),
    modelName: r.name.trim(),
    year: r.year,
    price: r.price,
    quantity: r.fleetItems[0]?.quantity ?? 0,
    image: r.image?.trim() || null,
  }));
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
};

export async function getFleetVehicleForAdminEdit(
  modelId: number,
): Promise<AdminFleetVehicleEditPayload | null> {
  const row = await prisma.carModel.findFirst({
    where: { id: modelId, fleetItems: { some: {} } },
    include: {
      brand: true,
      category: true,
      fleetItems: { orderBy: { id: "asc" }, take: 1 },
    },
  });
  if (!row || !row.fleetItems[0]) {
    return null;
  }
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
    quantity: row.fleetItems[0].quantity,
    image: row.image?.trim() || null,
    alt: row.alt?.trim() || null,
    badge: row.badge?.trim() || null,
  };
}
