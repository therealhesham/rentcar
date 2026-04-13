import { prisma } from "@/lib/prisma";

export async function getBrandsForAdminSelect() {
  return prisma.brand.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}
