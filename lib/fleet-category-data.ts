import { prisma } from "@/lib/prisma";

/** فئات الأسطول للصفحة الرئيسية — مرتبة حسب sortOrder */
export async function getFleetCategoriesForHome() {
  return prisma.fleetCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
  });
}

/** للإدارة: قائمة الفئات لاختيار الموديل */
export async function getFleetCategoriesForAdminSelect() {
  return prisma.fleetCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: { id: true, title: true, slug: true },
  });
}

/** للإدارة: كل الفئات مع عدد الموديلات */
export async function getFleetCategoriesForAdminFull() {
  return prisma.fleetCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: {
      _count: { select: { models: true } },
    },
  });
}

export async function getFleetCategoryById(id: number) {
  return prisma.fleetCategory.findUnique({
    where: { id },
    include: { _count: { select: { models: true } } },
  });
}
