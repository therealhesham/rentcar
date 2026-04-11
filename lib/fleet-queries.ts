import { prisma } from "@/lib/prisma";

/** كل موديلات سيارات ضمن فئة (slug) — للاستعلامات والتقارير */
export async function getCarModelsByCategorySlug(slug: string) {
  return prisma.carModel.findMany({
    where: { category: { slug } },
    include: { brand: true, category: true },
    orderBy: { id: "desc" },
  });
}

/** أسطول متاح (كمية أكبر من صفر) ضمن فئة */
export async function getAvailableFleetByCategorySlug(slug: string) {
  return prisma.fleet.findMany({
    where: {
      quantity: { gt: 0 },
      model: { category: { slug } },
    },
    include: {
      model: { include: { brand: true, category: true } },
    },
    orderBy: { id: "desc" },
  });
}
