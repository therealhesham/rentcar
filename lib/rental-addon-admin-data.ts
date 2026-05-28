import { prisma } from "@/lib/prisma";

export type RentalAddonAdminRow = {
  id: number;
  slug: string;
  titleAr: string;
  descriptionAr: string | null;
  infoAr: string | null;
  pricePerDay: number;
  iconKey: string | null;
  exclusiveGroup: string | null;
  sortOrder: number;
  isActive: boolean;
};

export async function getRentalAddonsForAdmin(): Promise<RentalAddonAdminRow[]> {
  try {
    return await prisma.rentalAddon.findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        id: true,
        slug: true,
        titleAr: true,
        descriptionAr: true,
        infoAr: true,
        pricePerDay: true,
        iconKey: true,
        exclusiveGroup: true,
        sortOrder: true,
        isActive: true,
      },
    });
  } catch {
    return [];
  }
}

export async function getRentalAddonById(
  id: number,
): Promise<RentalAddonAdminRow | null> {
  if (!Number.isInteger(id) || id < 1) return null;
  try {
    return await prisma.rentalAddon.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        titleAr: true,
        descriptionAr: true,
        infoAr: true,
        pricePerDay: true,
        iconKey: true,
        exclusiveGroup: true,
        sortOrder: true,
        isActive: true,
      },
    });
  } catch {
    return null;
  }
}
