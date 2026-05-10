import { prisma } from "@/lib/prisma";

export type RentalAddonDTO = {
  id: number;
  slug: string;
  titleAr: string;
  descriptionAr: string | null;
  pricePerDay: number;
  iconKey: string | null;
};

export async function getActiveRentalAddons(): Promise<RentalAddonDTO[]> {
  try {
    const rows = await prisma.rentalAddon.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: {
        id: true,
        slug: true,
        titleAr: true,
        descriptionAr: true,
        pricePerDay: true,
        iconKey: true,
      },
    });
    return rows;
  } catch {
    return [];
  }
}
