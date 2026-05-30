import { prisma } from "@/lib/prisma";

export type RentalDiscountAdminRow = {
  id: number;
  labelAr: string;
  kind: "PERCENT" | "FIXED_DAILY";
  value: number;
  startsAt: Date | null;
  endsAt: Date | null;
  brandId: number | null;
  brandName: string | null;
  carModelId: number | null;
  carModelLabel: string | null;
  branchId: number | null;
  branchName: string | null;
  isActive: boolean;
  sortOrder: number;
};

export async function getRentalDiscountsForAdmin(): Promise<RentalDiscountAdminRow[]> {
  const rows = await prisma.rentalDiscount.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: {
      brand: { select: { name: true } },
      carModel: { select: { name: true, year: true, brand: { select: { name: true } } } },
      branch: { select: { name: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    labelAr: r.labelAr,
    kind: r.kind,
    value: r.value,
    startsAt: r.startsAt,
    endsAt: r.endsAt,
    brandId: r.brandId,
    brandName: r.brand?.name ?? null,
    carModelId: r.carModelId,
    carModelLabel: r.carModel
      ? `${r.carModel.brand.name} ${r.carModel.name} ${r.carModel.year}`
      : null,
    branchId: r.branchId,
    branchName: r.branch?.name ?? null,
    isActive: r.isActive,
    sortOrder: r.sortOrder,
  }));
}

export async function getRentalDiscountForAdminEdit(
  id: number,
): Promise<RentalDiscountAdminRow | null> {
  if (!Number.isInteger(id) || id < 1) return null;
  const rows = await getRentalDiscountsForAdmin();
  return rows.find((r) => r.id === id) ?? null;
}

export type DiscountModelOption = {
  id: number;
  name: string;
  year: number;
  price: number;
  brandId: number;
  brand: { name: string };
};

export async function getCarModelsForDiscountSelect(): Promise<DiscountModelOption[]> {
  return prisma.carModel.findMany({
    select: {
      id: true,
      name: true,
      year: true,
      price: true,
      brandId: true,
      brand: { select: { name: true } },
    },
    orderBy: [{ brand: { name: "asc" } }, { name: "asc" }, { year: "desc" }],
  });
}

export async function getBranchesForDiscountSelect() {
  return prisma.branch.findMany({
    where: { isActive: true },
    select: { id: true, name: true, slug: true },
    orderBy: { sortOrder: "asc" },
  });
}
