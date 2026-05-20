import { bookingBranchRelationsSelect } from "@/lib/booking-branches";
import { prisma } from "@/lib/prisma";

export async function loadAdminBookingDetail(id: number) {
  if (!Number.isInteger(id) || id < 1) return null;

  return prisma.bookingRequest.findUnique({
    where: { id },
    include: {
      carModel: { include: { brand: true, category: true } },
      customer: { select: { id: true, name: true, email: true, phone: true } },
      ...bookingBranchRelationsSelect,
    },
  });
}

export type AdminBookingDetail = NonNullable<Awaited<ReturnType<typeof loadAdminBookingDetail>>>;

export async function loadAdminBookingEditContext() {
  const [categories, modelsRaw] = await Promise.all([
    prisma.fleetCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: { slug: true, title: true },
    }),
    prisma.carModel.findMany({
      where: { fleetItems: { some: { quantity: { gt: 0 } } } },
      select: {
        id: true,
        name: true,
        brand: { select: { name: true } },
      },
      orderBy: [{ brand: { name: "asc" } }, { name: "asc" }],
    }),
  ]);

  return {
    categories,
    models: modelsRaw.map((m) => ({
      id: m.id,
      label: `${m.brand.name} ${m.name}`,
    })),
  };
}
