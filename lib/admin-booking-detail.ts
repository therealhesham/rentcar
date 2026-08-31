import { bookingBranchRelationsSelect } from "@/lib/booking-branches";
import { customerKycSelect } from "@/lib/booking-kyc-display";
import { listAvailableCarModelIdsBulk } from "@/lib/direct-booking";
import { prisma } from "@/lib/prisma";

export async function loadAdminBookingDetail(id: number) {
  if (!Number.isInteger(id) || id < 1) return null;

  return prisma.bookingRequest.findUnique({
    where: { id },
    include: {
      carModel: { include: { brand: true, category: true } },
      customer: {
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          ...customerKycSelect,
        },
      },
      ...bookingBranchRelationsSelect,
    },
  });
}

export type AdminBookingDetail = NonNullable<Awaited<ReturnType<typeof loadAdminBookingDetail>>>;

export async function loadAdminBookingEditContext(availability?: {
  /** فرع الإرجاع — يُعرض فقط الموديلات المتوفرة فيه خلال الفترة */
  branchSlug: string;
  pickupDate: Date;
  numberOfDays: number;
  /** استثناء الحجز الجاري تعديله حتى لا يحجب نفسه عن موديله الحالي */
  excludeBookingRequestId?: number;
}) {
  const [categories, modelsRaw, branchesRaw, availableIds] = await Promise.all([
    prisma.fleetCategory.findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: { slug: true, title: true },
    }),
    prisma.carModel.findMany({
      where: { fleetItems: { some: { quantity: { gt: 0 } } } },
      select: {
        id: true,
        name: true,
        year: true,
        brand: { select: { name: true } },
      },
      orderBy: [{ brand: { name: "asc" } }, { name: "asc" }],
    }),
    prisma.branch.findMany({
      where: { isActive: true },
      select: { slug: true, name: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    }),
    availability ? listAvailableCarModelIdsBulk(availability) : Promise.resolve(null),
  ]);

  const availableSet = availableIds ? new Set(availableIds) : null;

  return {
    categories,
    models: modelsRaw
      .filter((m) => !availableSet || availableSet.has(m.id))
      .map((m) => ({
        id: m.id,
        label: `${m.brand.name} ${m.name} ${m.year}`,
      })),
    branches: branchesRaw,
  };
}
