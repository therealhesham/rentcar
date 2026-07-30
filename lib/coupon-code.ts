import type { CouponDiscountKind, CouponScope } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type ResolvedCoupon = {
  id: number;
  code: string;
  kind: CouponDiscountKind;
  value: number;
  scope: CouponScope;
  maxUses: number | null;
};

const ERROR_NOT_FOUND = "كود الخصم غير صحيح.";
const ERROR_INACTIVE = "كود الخصم غير مُفعَّل حالياً.";
const ERROR_NOT_STARTED = "كود الخصم لم تبدأ صلاحيته بعد.";
const ERROR_EXPIRED = "انتهت صلاحية كود الخصم.";
const ERROR_MAX_USES_REACHED = "نفد الحد الأقصى لاستخدام هذا الكود.";
const ERROR_CUSTOMER_LIMIT_REACHED = "لقد استخدمت هذا الكود من قبل.";

/** يتحقق من صلاحية كود الخصم: مفعّل، داخل الفترة، لم يتجاوز حد الاستخدام الإجمالي أو حد هذا العميل. */
export async function resolveCouponCode(
  rawCode: string,
  ctx: { customerPhone: string; now?: Date },
): Promise<{ ok: true; coupon: ResolvedCoupon } | { ok: false; error: string }> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, error: ERROR_NOT_FOUND };

  const row = await prisma.couponCode.findUnique({ where: { code } });
  if (!row) return { ok: false, error: ERROR_NOT_FOUND };
  if (!row.isActive) return { ok: false, error: ERROR_INACTIVE };

  const now = ctx.now ?? new Date();
  if (row.startsAt && now.getTime() < row.startsAt.getTime()) {
    return { ok: false, error: ERROR_NOT_STARTED };
  }
  if (row.endsAt && now.getTime() > row.endsAt.getTime()) {
    return { ok: false, error: ERROR_EXPIRED };
  }
  if (row.maxUses != null && row.usesCount >= row.maxUses) {
    return { ok: false, error: ERROR_MAX_USES_REACHED };
  }
  if (row.perCustomerLimit != null) {
    const customerUses = await prisma.couponRedemption.count({
      where: { couponCodeId: row.id, customerPhone: ctx.customerPhone },
    });
    if (customerUses >= row.perCustomerLimit) {
      return { ok: false, error: ERROR_CUSTOMER_LIMIT_REACHED };
    }
  }

  return {
    ok: true,
    coupon: {
      id: row.id,
      code: row.code,
      kind: row.kind,
      value: row.value,
      scope: row.scope,
      maxUses: row.maxUses,
    },
  };
}

/** خصم كوبون بنطاق RENTAL_ONLY — يُطبَّق على السعر اليومي قبل ما يتجمّد في اللقطة، زي RentalDiscount بالظبط. */
export function computeCouponDiscountPerDay(
  basePricePerDayExclTax: number,
  kind: CouponDiscountKind,
  value: number,
): { discountedPricePerDayExclTax: number; discountPerDayExclTax: number } {
  const base = Math.max(0, Math.round(basePricePerDayExclTax));
  if (base <= 0) return { discountedPricePerDayExclTax: 0, discountPerDayExclTax: 0 };

  let savings = 0;
  if (kind === "PERCENT") {
    const pct = Math.min(100, Math.max(1, Math.round(value)));
    savings = Math.round((base * pct) / 100);
  } else {
    savings = Math.min(base, Math.max(0, Math.round(value)));
  }
  return { discountedPricePerDayExclTax: base - savings, discountPerDayExclTax: savings };
}

/** خصم كوبون بنطاق FULL_TOTAL — مبلغ يُطرح من الإجمالي الفرعي (إيجار + إضافات + رسوم) قبل الضريبة. */
export function computeCouponDiscountOnSubtotal(
  subtotalExclTax: number,
  kind: CouponDiscountKind,
  value: number,
): number {
  const sub = Math.max(0, subtotalExclTax);
  if (sub <= 0) return 0;

  if (kind === "PERCENT") {
    const pct = Math.min(100, Math.max(1, Math.round(value)));
    return Math.round((sub * pct) / 100 * 100) / 100;
  }
  return Math.min(sub, Math.max(0, Math.round(value)));
}

/** نص مختصر للعرض على العميل: «خصم ١٠٪» أو «وفّرت ٥٠ ر.س». */
export function buildCouponDiscountLabelAr(
  kind: CouponDiscountKind,
  value: number,
  savingsAmountSar: number,
): string {
  if (savingsAmountSar <= 0) return "";
  if (kind === "PERCENT") {
    const pct = Math.min(100, Math.max(1, Math.round(value)));
    return `خصم ${pct.toLocaleString("ar-SA")}٪`;
  }
  return `وفّرت ${savingsAmountSar.toLocaleString("en-US")} ر.س`;
}
