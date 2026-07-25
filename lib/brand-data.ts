import { prisma } from "@/lib/prisma";

export async function getBrandsForAdminSelect() {
  return prisma.brand.findMany({
    select: { id: true, name: true, nameEn: true },
    orderBy: { name: "asc" },
  });
}

export async function getFleetBrandsForAdminFull() {
  return prisma.brand.findMany({
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      nameEn: true,
      createdAt: true,
      _count: {
        select: { models: true },
      },
    },
  });
}

export async function getBrandForAdminEdit(id: number) {
  return prisma.brand.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      nameEn: true,
      _count: {
        select: { models: true },
      },
    },
  });
}
