import type { CouponDiscountKind, CouponScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CustomizedCouponAdminRow = {
  id: number;
  code: string;
  customerPhone: string;
  kind: CouponDiscountKind;
  value: number;
  scope: CouponScope;
  endsAt: Date | null;
  isActive: boolean;
  isUsed: boolean;
  usedAt: Date | null;
  usedByBookingRequestId: number | null;
  createdAt: Date;
};

const ROW_SELECT = {
  id: true,
  code: true,
  customerPhone: true,
  kind: true,
  value: true,
  scope: true,
  endsAt: true,
  isActive: true,
  isUsed: true,
  usedAt: true,
  usedByBookingRequestId: true,
  createdAt: true,
} as const;

export async function getCustomizedCouponsForAdmin(): Promise<CustomizedCouponAdminRow[]> {
  return prisma.customizedCoupon.findMany({
    orderBy: [{ createdAt: "desc" }],
    select: ROW_SELECT,
  });
}

export async function getCustomizedCouponForAdminEdit(
  id: number,
): Promise<CustomizedCouponAdminRow | null> {
  return prisma.customizedCoupon.findUnique({
    where: { id },
    select: ROW_SELECT,
  });
}
