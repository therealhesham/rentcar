/**
 * إعادة تطبيق كوبون `RENTAL_ONLY` عند تبديل موديل السيارة من لوحة الإدارة.
 *
 * الكوبون بنطاق `RENTAL_ONLY` يُطبَّق على سعر الإيجار نفسه لا على الإجمالي، لذا
 * حين يبدّل الأدمن الموديل لا بد من إعادة حسابه على سعر الموديل الجديد (بعد
 * الخصم التلقائي) بدل الإبقاء على رقم يخص سعر السيارة القديمة — انظر نقطة
 * الاستدعاء في `updateBookingRequestByAdmin` داخل lib/direct-booking.ts.
 */
import { prisma } from "@/lib/prisma";
import { computeCouponDiscountForPeriod } from "@/lib/coupon-code";
import type { RentalPeriodKind } from "@/lib/min-price-floor";

export async function repriceRentalOnlyCouponForModelChange(input: {
  couponCode: string;
  /** مبلغ الفترة (يوم كامل أو شهر) للموديل الجديد بعد الخصم التلقائي، قبل الكوبون. */
  baseAfterAutoDiscountExclTax: number;
  periodKind: RentalPeriodKind;
}): Promise<
  | { ok: true; discountedAmountExclTax: number }
  | { ok: false; error: string }
> {
  const row = await prisma.couponCode.findUnique({
    where: { code: input.couponCode },
    select: { kind: true, value: true, scope: true, isActive: true },
  });
  if (!row || !row.isActive || row.scope !== "RENTAL_ONLY") {
    return {
      ok: false,
      error:
        "كود الخصم لم يعد صالحاً لإعادة تطبيقه على الموديل الجديد. أزل الكوبون أولاً ثم بدّل السيارة.",
    };
  }

  const { discountedAmountExclTax } = computeCouponDiscountForPeriod(
    input.baseAfterAutoDiscountExclTax,
    row.kind,
    row.value,
    input.periodKind,
  );
  return { ok: true, discountedAmountExclTax };
}
