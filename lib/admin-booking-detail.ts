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
