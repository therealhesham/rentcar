import type { CouponDiscountKind, CouponScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type CouponCodeAdminRow = {
  id: number;
  code: string;
  kind: CouponDiscountKind;
  value: number;
  scope: CouponScope;
  startsAt: Date | null;
  endsAt: Date | null;
  isActive: boolean;
  maxUses: number | null;
  usesCount: number;
  perCustomerLimit: number | null;
  createdAt: Date;
};

export async function getCouponCodesForAdmin(): Promise<CouponCodeAdminRow[]> {
  return prisma.couponCode.findMany({
    orderBy: [{ createdAt: "desc" }],
    select: {
      id: true,
      code: true,
      kind: true,
      value: true,
      scope: true,
      startsAt: true,
      endsAt: true,
      isActive: true,
      maxUses: true,
      usesCount: true,
      perCustomerLimit: true,
      createdAt: true,
    },
  });
}

export async function getCouponCodeForAdminEdit(id: number): Promise<CouponCodeAdminRow | null> {
  return prisma.couponCode.findUnique({
    where: { id },
    select: {
      id: true,
      code: true,
      kind: true,
      value: true,
      scope: true,
      startsAt: true,
      endsAt: true,
      isActive: true,
      maxUses: true,
      usesCount: true,
      perCustomerLimit: true,
      createdAt: true,
    },
  });
}

export type CouponRedemptionAdminRow = {
  id: number;
  bookingRequestId: number;
  customerPhone: string;
  discountAmountSar: number;
  redeemedAt: Date;
};

export async function getCouponRedemptionsForAdmin(
  couponCodeId: number,
): Promise<{ couponCode: CouponCodeAdminRow | null; redemptions: CouponRedemptionAdminRow[] }> {
  const [couponCode, redemptions] = await Promise.all([
    getCouponCodeForAdminEdit(couponCodeId),
    prisma.couponRedemption.findMany({
      where: { couponCodeId },
      orderBy: [{ redeemedAt: "desc" }],
      select: {
        id: true,
        bookingRequestId: true,
        customerPhone: true,
        discountAmountSar: true,
        redeemedAt: true,
      },
    }),
  ]);
  return { couponCode, redemptions };
}
