import { prisma } from "@/lib/prisma";
import { localizeDbField } from "@/lib/localize";

/** فئات الأسطول للصفحة الرئيسية — مرتبة حسب sortOrder */
export async function getFleetCategoriesForHome(locale: string = "ar") {
  const rows = await prisma.fleetCategory.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: {
      _count: { select: { models: true } },
      models: {
        take: 3,
        orderBy: [{ id: "asc" }],
        select: {
          id: true,
          name: true,
          nameEn: true,
          chairs: true,
          image: true,
          alt: true,
          brand: { select: { name: true } },
        },
      },
    },
  });
  return rows.map((r) => ({
    ...r,
    title: localizeDbField(r, "title", locale),
    description: localizeDbField(r, "description", locale),
    models: r.models.map((m) => ({
      ...m,
      name: localizeDbField(m, "name", locale),
    })),
  }));
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
