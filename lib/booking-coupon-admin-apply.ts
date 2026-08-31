/**
 * تطبيق كود خصم **جديد** على حجز مباشر موجود بالفعل، من لوحة الإدارة (مودال تعديل الحجز).
 *
 * يطابق منطق العميل عند الحجز الأول حرفياً (`createDirectBooking` في `lib/direct-booking.ts`):
 * الكوبون يُطبَّق فوق السعر **المجمَّد الظاهر للعميل حالياً** (لا يُعاد اشتقاق الخصم التلقائي)،
 * ثم أرضية السعر الحية. كوبون واحد فقط لكل حجز — لا استبدال ولا تكديس.
 */
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildCouponDiscountLabelAr,
  computeCouponDiscountForPeriod,
  computeCouponDiscountOnSubtotal,
  resolveCouponCode,
} from "@/lib/coupon-code";
import {
  NO_PRICE_FLOOR,
  applyPriceFloorPerDay,
  capFullTotalDiscountToFloor,
  resolvePriceFloorForModel,
  type RentalPeriodKind,
} from "@/lib/min-price-floor";
import {
  parseBookingPricingSnapshot,
  resolveBookingRentalPricePerDayExclTax,
  type CouponCodeSnap,
} from "@/lib/booking-pricing-snapshot";
import {
  bookingDaysPriceInputFromSnapshot,
  bookingTotalInclTaxForDays,
  computeBalanceAfterTotalChange,
} from "@/lib/booking-edit";
import { computeCheckoutTotals } from "@/lib/booking-checkout-pricing";
import { CouponUnavailableError, isSerializationConflict } from "@/lib/direct-booking";
import { BOOKING_EVENTS, logBookingEvent } from "@/lib/booking-audit";
import { recordMinPriceFloorApplied } from "@/lib/min-price-floor-audit";

const TERMINAL_STATUSES = new Set(["CANCELLED", "REJECTED"]);

class CouponAlreadyAppliedError extends Error {
  constructor() {
    super("COUPON_ALREADY_APPLIED");
    this.name = "CouponAlreadyAppliedError";
  }
}

type CouponApplyBooking = {
  id: number;
  kind: string;
  status: string;
  phone: string;
  numberOfDays: number;
  addonsJson: string | null;
  returnBranchId: number | null;
  paymentStatus: string;
  paidAmountSar: number | null;
  snapshotTotalAmountSar: number | null;
  balanceDueAtBranchSar: number | null;
  refundDueToCustomerSar: number | null;
  refundDueSettledAt: Date | null;
  carModel: {
    id: number;
    price: number;
    vatRatePercent: number;
    minPricePerDayExclTax: number | null;
    minPriceMonthlyExclTax: number | null;
    name: string;
    year: number;
    brand: { name: string };
  };
};

type CouponApplyContext = {
  booking: CouponApplyBooking;
  periodKind: RentalPeriodKind;
  existingCoupon: CouponCodeSnap | null;
};

async function loadCouponApplyContext(
  bookingRequestId: number,
): Promise<{ ok: true; ctx: CouponApplyContext } | { ok: false; error: string }> {
  const booking = await prisma.bookingRequest.findUnique({
    where: { id: bookingRequestId },
    select: {
      id: true,
      kind: true,
      status: true,
      phone: true,
      numberOfDays: true,
      rentalPeriodKind: true,
      addonsJson: true,
      returnBranchId: true,
      paymentStatus: true,
      paidAmountSar: true,
      snapshotTotalAmountSar: true,
      balanceDueAtBranchSar: true,
      refundDueToCustomerSar: true,
      refundDueSettledAt: true,
      carModel: {
        select: {
          id: true,
          price: true,
          vatRatePercent: true,
          minPricePerDayExclTax: true,
          minPriceMonthlyExclTax: true,
          name: true,
          year: true,
          brand: { select: { name: true } },
        },
      },
    },
  });
  if (!booking || booking.kind !== "DIRECT" || !booking.carModel) {
    return { ok: false, error: "تطبيق كود الخصم متاح فقط للحجوزات المباشرة." };
  }
  if (TERMINAL_STATUSES.has(booking.status.trim().toUpperCase())) {
    return { ok: false, error: "لا يمكن تطبيق كود خصم على حجز ملغى أو مرفوض." };
  }
  const periodKindRaw = booking.rentalPeriodKind?.trim().toUpperCase();
  if (periodKindRaw !== "DAILY" && periodKindRaw !== "MONTHLY") {
    return {
      ok: false,
      error: "هذا الحجز أقدم من حفظ نوع فترة التسعير، فلا يمكن تطبيق كود خصم عليه.",
    };
  }
  const { couponCode: existingCoupon } = parseBookingPricingSnapshot(booking.addonsJson);
  return {
    ok: true,
    ctx: {
      booking: { ...booking, carModel: booking.carModel },
      periodKind: periodKindRaw,
      existingCoupon,
    },
  };
}

type CouponComputation = {
  scope: "RENTAL_ONLY" | "FULL_TOTAL";
  couponId: number;
  couponMaxUses: number | null;
  currentPricePerDayExclTax: number;
  newPricePerDayExclTax: number;
  newAddonsJson: string;
  discountAmountSar: number;
  labelAr: string;
  floorApplied: boolean;
  carLabel: string;
  basePricePerDayExclTax: number;
  finalPricePerDayExclTax: number;
  floorPerDayExclTax: number | null;
  withheldDiscountExclTax: number;
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

async function computeCouponApplication(
  ctx: CouponApplyContext,
  code: string,
): Promise<{ ok: true; result: CouponComputation } | { ok: false; error: string }> {
  const { booking, periodKind } = ctx;
  const model = booking.carModel;
  const days = booking.numberOfDays;
  const isMonthly = periodKind === "MONTHLY";
  const carLabel = `${model.brand.name} ${model.name} ${model.year}`.trim();

  const resolved = await resolveCouponCode(code, { customerPhone: booking.phone, periodKind });
  if (!resolved.ok) return { ok: false, error: resolved.error };
  const coupon = resolved.coupon;

  const priceFloor = await resolvePriceFloorForModel(model.id, booking.returnBranchId, {
    minPricePerDayExclTax: model.minPricePerDayExclTax,
    minPriceMonthlyExclTax: model.minPriceMonthlyExclTax,
  });
  const enforcedFloor = coupon.canBypassMinPrice ? NO_PRICE_FLOOR : priceFloor;

  // السعر الحالي المجمَّد — «الظاهر للعميل» فعلاً؛ الكوبون يُطبَّق فوقه لا فوق سعر مُعاد اشتقاقه.
  const currentPricePerDayExclTax = resolveBookingRentalPricePerDayExclTax(
    model.price,
    booking.addonsJson,
  );

  if (coupon.scope === "RENTAL_ONLY") {
    const periodAmountExclTax = isMonthly
      ? currentPricePerDayExclTax * days
      : currentPricePerDayExclTax;
    const { discountedAmountExclTax } = computeCouponDiscountForPeriod(
      periodAmountExclTax,
      coupon.kind,
      coupon.value,
      periodKind,
    );
    const toPerDay = (amt: number) => (isMonthly ? amt / days : amt);
    const floorOutcome = applyPriceFloorPerDay(
      toPerDay(discountedAmountExclTax),
      currentPricePerDayExclTax,
      enforcedFloor,
      periodKind,
      days,
    );
    const newPricePerDayExclTax = floorOutcome.finalPricePerDayExclTax;
    const effectiveDiscountPerDay = round2(currentPricePerDayExclTax - newPricePerDayExclTax);
    if (effectiveDiscountPerDay <= 0) {
      return { ok: false, error: "لا يمكن تطبيق هذا الكود على هذا السعر." };
    }

    let parsed: Record<string, unknown> = {};
    if (booking.addonsJson?.trim()) {
      try {
        parsed = JSON.parse(booking.addonsJson) as Record<string, unknown>;
      } catch {
        parsed = {};
      }
    }
    parsed.rentalPricePerDayExclTax = round2(newPricePerDayExclTax);
    if (floorOutcome.floorPerDayExclTax != null) {
      parsed.rentalFloorPerDayExclTax = round2(floorOutcome.floorPerDayExclTax);
    } else {
      delete parsed.rentalFloorPerDayExclTax;
    }
    delete parsed.rentalDiscount; // الكوبون يحل محل الخصم التلقائي المعروض.
    const snap: CouponCodeSnap = {
      code: coupon.code,
      kind: coupon.kind,
      scope: "RENTAL_ONLY",
      discountExclTax: 0,
    };
    parsed.couponCode = snap;

    return {
      ok: true,
      result: {
        scope: "RENTAL_ONLY",
        couponId: coupon.id,
        couponMaxUses: coupon.maxUses,
        currentPricePerDayExclTax,
        newPricePerDayExclTax,
        newAddonsJson: JSON.stringify(parsed),
        discountAmountSar: round2(effectiveDiscountPerDay * days),
        labelAr: buildCouponDiscountLabelAr(coupon.kind, coupon.value, effectiveDiscountPerDay),
        floorApplied: floorOutcome.floorApplied,
        carLabel,
        basePricePerDayExclTax: floorOutcome.basePricePerDayExclTax,
        finalPricePerDayExclTax: floorOutcome.finalPricePerDayExclTax,
        floorPerDayExclTax: floorOutcome.floorPerDayExclTax,
        withheldDiscountExclTax: floorOutcome.withheldDiscountExclTax,
      },
    };
  }

  // FULL_TOTAL
  const priceInput = bookingDaysPriceInputFromSnapshot(model.price, model.vatRatePercent, booking.addonsJson);
  const addonRows = priceInput.addonPerDayExclTax.map((p) => ({ pricePerDay: p }));
  const preDiscountTotals = computeCheckoutTotals(
    priceInput.pricePerDayExclTax,
    days,
    priceInput.vatRatePercent,
    addonRows,
    { oneTimeFeesExclTax: priceInput.oneTimeFeesExclTax },
  );
  const requestedDiscount = computeCouponDiscountOnSubtotal(
    preDiscountTotals.subtotalExclTax,
    coupon.kind,
    coupon.value,
  );
  const floorPerDay = isMonthly
    ? enforcedFloor.minPriceMonthlyExclTax != null
      ? enforcedFloor.minPriceMonthlyExclTax / days
      : null
    : enforcedFloor.minPricePerDayExclTax;
  const capped = capFullTotalDiscountToFloor(
    requestedDiscount,
    preDiscountTotals.subtotalExclTax,
    floorPerDay,
    days,
  );
  if (capped.discountExclTax <= 0) {
    return { ok: false, error: "لا يمكن تطبيق هذا الكود على هذا السعر." };
  }

  let parsed: Record<string, unknown> = {};
  if (booking.addonsJson?.trim()) {
    try {
      parsed = JSON.parse(booking.addonsJson) as Record<string, unknown>;
    } catch {
      parsed = {};
    }
  }
  if (floorPerDay != null) {
    parsed.rentalFloorPerDayExclTax = round2(floorPerDay);
  } else if (!coupon.canBypassMinPrice) {
    delete parsed.rentalFloorPerDayExclTax;
  }
  const snap: CouponCodeSnap = {
    code: coupon.code,
    kind: coupon.kind,
    scope: "FULL_TOTAL",
    discountExclTax: capped.discountExclTax,
  };
  parsed.couponCode = snap;

  return {
    ok: true,
    result: {
      scope: "FULL_TOTAL",
      couponId: coupon.id,
      couponMaxUses: coupon.maxUses,
      currentPricePerDayExclTax: priceInput.pricePerDayExclTax,
      newPricePerDayExclTax: priceInput.pricePerDayExclTax,
      newAddonsJson: JSON.stringify(parsed),
      discountAmountSar: capped.discountExclTax,
      labelAr: buildCouponDiscountLabelAr(coupon.kind, coupon.value, capped.discountExclTax),
      floorApplied: capped.floorApplied,
      carLabel,
      basePricePerDayExclTax: preDiscountTotals.subtotalExclTax / days,
      finalPricePerDayExclTax: (preDiscountTotals.subtotalExclTax - capped.discountExclTax) / days,
      floorPerDayExclTax: floorPerDay,
      withheldDiscountExclTax: capped.withheldDiscountExclTax,
    },
  };
}

function checkExistingCouponConflict(
  existingCoupon: CouponCodeSnap | null,
  code: string,
): { conflict: true; error: string } | { conflict: false; alreadyApplied: boolean } {
  if (!existingCoupon) return { conflict: false, alreadyApplied: false };
  if (existingCoupon.code === code) return { conflict: false, alreadyApplied: true };
  return { conflict: true, error: "الحجز عليه كود خصم آخر بالفعل." };
}

export type AdminCouponPreviewResult =
  | {
      ok: true;
      alreadyApplied: false;
      scope: "RENTAL_ONLY" | "FULL_TOTAL";
      currentPricePerDayExclTax: number;
      currentTotalInclTax: number;
      newPricePerDayExclTax: number;
      newTotalInclTax: number;
      discountAmountSar: number;
      labelAr: string;
      floorApplied: boolean;
    }
  | { ok: false; error: string; alreadyApplied?: boolean };

export async function previewAdminCouponApply(
  bookingRequestId: number,
  rawCode: string,
): Promise<AdminCouponPreviewResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, error: "أدخل كود الخصم." };

  const loaded = await loadCouponApplyContext(bookingRequestId);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const { ctx } = loaded;

  const conflict = checkExistingCouponConflict(ctx.existingCoupon, code);
  if (conflict.conflict) return { ok: false, error: conflict.error };
  if (conflict.alreadyApplied) {
    return { ok: false, error: `هذا الكود مطبَّق على الحجز بالفعل (${code}).`, alreadyApplied: true };
  }

  const computed = await computeCouponApplication(ctx, code);
  if (!computed.ok) return { ok: false, error: computed.error };
  const r = computed.result;

  const oldPriceInput = bookingDaysPriceInputFromSnapshot(
    ctx.booking.carModel.price,
    ctx.booking.carModel.vatRatePercent,
    ctx.booking.addonsJson,
  );
  const currentTotalInclTax = bookingTotalInclTaxForDays(oldPriceInput, ctx.booking.numberOfDays);
  const newPriceInput = bookingDaysPriceInputFromSnapshot(
    ctx.booking.carModel.price,
    ctx.booking.carModel.vatRatePercent,
    r.newAddonsJson,
  );
  const newTotalInclTax = bookingTotalInclTaxForDays(newPriceInput, ctx.booking.numberOfDays);

  return {
    ok: true,
    alreadyApplied: false,
    scope: r.scope,
    currentPricePerDayExclTax: r.currentPricePerDayExclTax,
    currentTotalInclTax,
    newPricePerDayExclTax: r.newPricePerDayExclTax,
    newTotalInclTax,
    discountAmountSar: r.discountAmountSar,
    labelAr: r.labelAr,
    floorApplied: r.floorApplied,
  };
}

export type AdminCouponApplyResult =
  | {
      ok: true;
      alreadyApplied: boolean;
      snapshotTotalAmountSar: number;
      creditForCustomerSar: number;
    }
  | { ok: false; error: string };

export async function applyAdminCoupon(
  bookingRequestId: number,
  rawCode: string,
): Promise<AdminCouponApplyResult> {
  const code = rawCode.trim().toUpperCase();
  if (!code) return { ok: false, error: "أدخل كود الخصم." };

  const loaded = await loadCouponApplyContext(bookingRequestId);
  if (!loaded.ok) return { ok: false, error: loaded.error };
  const { ctx } = loaded;

  const conflict = checkExistingCouponConflict(ctx.existingCoupon, code);
  if (conflict.conflict) return { ok: false, error: conflict.error };
  if (conflict.alreadyApplied) {
    return {
      ok: true,
      alreadyApplied: true,
      snapshotTotalAmountSar: ctx.booking.snapshotTotalAmountSar ?? 0,
      creditForCustomerSar: 0,
    };
  }

  const computed = await computeCouponApplication(ctx, code);
  if (!computed.ok) return { ok: false, error: computed.error };
  const r = computed.result;

  const oldPriceInput = bookingDaysPriceInputFromSnapshot(
    ctx.booking.carModel.price,
    ctx.booking.carModel.vatRatePercent,
    ctx.booking.addonsJson,
  );
  const oldTotal = bookingTotalInclTaxForDays(oldPriceInput, ctx.booking.numberOfDays);
  const newPriceInput = bookingDaysPriceInputFromSnapshot(
    ctx.booking.carModel.price,
    ctx.booking.carModel.vatRatePercent,
    r.newAddonsJson,
  );
  const newTotal = bookingTotalInclTaxForDays(newPriceInput, ctx.booking.numberOfDays);
  const diff = newTotal - oldTotal;

  const balanceOutcome = computeBalanceAfterTotalChange(ctx.booking, diff, oldTotal);

  const runOnce = () =>
    prisma.$transaction(
      async (tx) => {
        // إعادة فحص الحالة والكوبون داخل المعاملة — يحمي من سباق تعديل متزامن.
        const fresh = await tx.bookingRequest.findUnique({
          where: { id: bookingRequestId },
          select: { id: true, kind: true, status: true, addonsJson: true },
        });
        if (!fresh || fresh.kind !== "DIRECT") {
          throw Object.assign(new Error("NOT_DIRECT"), {
            userMessage: "الطلب ليس حجزاً مباشراً أو غير موجود.",
          });
        }
        if (TERMINAL_STATUSES.has(fresh.status.trim().toUpperCase())) {
          throw Object.assign(new Error("TERMINAL"), {
            userMessage: "لا يمكن تطبيق كود خصم على حجز ملغى أو مرفوض.",
          });
        }
        const { couponCode: freshExisting } = parseBookingPricingSnapshot(fresh.addonsJson);
        if (freshExisting) {
          if (freshExisting.code === code) throw new CouponAlreadyAppliedError();
          throw Object.assign(new Error("COUPON_RACE"), {
            userMessage: "طُبِّق كود خصم آخر على هذا الحجز للتو. أعد فتح المودال وتحقق من الحالة.",
          });
        }

        if (r.couponMaxUses != null) {
          const updated = await tx.couponCode.updateMany({
            where: { id: r.couponId, usesCount: { lt: r.couponMaxUses } },
            data: { usesCount: { increment: 1 } },
          });
          if (updated.count === 0) {
            throw new CouponUnavailableError("نفد الحد الأقصى لاستخدام كود الخصم.");
          }
        } else {
          await tx.couponCode.update({
            where: { id: r.couponId },
            data: { usesCount: { increment: 1 } },
          });
        }
        await tx.couponRedemption.create({
          data: {
            couponCodeId: r.couponId,
            bookingRequestId,
            customerPhone: ctx.booking.phone,
            discountAmountSar: r.discountAmountSar,
          },
        });

        await tx.bookingRequest.update({
          where: { id: bookingRequestId },
          data: {
            addonsJson: r.newAddonsJson,
            snapshotTotalAmountSar: balanceOutcome.snapshotTotalAmountSar,
            ...(balanceOutcome.balanceDueAtBranchSar !== undefined
              ? { balanceDueAtBranchSar: balanceOutcome.balanceDueAtBranchSar }
              : {}),
            ...(balanceOutcome.refundDueToCustomerSar !== undefined
              ? { refundDueToCustomerSar: balanceOutcome.refundDueToCustomerSar }
              : {}),
          },
        });
      },
      { maxWait: 8000, timeout: 15000, isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

  try {
    await runOnce();
  } catch (e) {
    if (e instanceof CouponAlreadyAppliedError) {
      return {
        ok: true,
        alreadyApplied: true,
        snapshotTotalAmountSar: ctx.booking.snapshotTotalAmountSar ?? 0,
        creditForCustomerSar: 0,
      };
    }
    if (isSerializationConflict(e)) {
      try {
        await runOnce();
      } catch (e2) {
        return { ok: false, error: mapCouponApplyError(e2) };
      }
    } else {
      return { ok: false, error: mapCouponApplyError(e) };
    }
  }

  await logBookingEvent({
    bookingId: bookingRequestId,
    event: BOOKING_EVENTS.COUPON_APPLIED_BY_ADMIN,
    actorKind: "ADMIN",
    notes: `تطبيق كود الخصم ${r.labelAr ? `${code} (${r.labelAr})` : code} — توفير ${r.discountAmountSar} ر.س.`,
  });

  if (r.floorApplied && r.floorPerDayExclTax != null) {
    await recordMinPriceFloorApplied({
      bookingId: bookingRequestId,
      branchId: ctx.booking.returnBranchId,
      carLabel: r.carLabel,
      periodKind: ctx.periodKind,
      basePricePerDayExclTax: r.basePricePerDayExclTax,
      discountedPricePerDayExclTax: r.finalPricePerDayExclTax,
      floorPerDayExclTax: r.floorPerDayExclTax,
      finalPricePerDayExclTax: r.finalPricePerDayExclTax,
      withheldDiscountExclTax: r.withheldDiscountExclTax,
      days: ctx.booking.numberOfDays,
      discountSource: { kind: "COUPON", code },
    });
  }

  return {
    ok: true,
    alreadyApplied: false,
    snapshotTotalAmountSar: balanceOutcome.snapshotTotalAmountSar,
    creditForCustomerSar: balanceOutcome.creditForCustomerSar,
  };
}

function mapCouponApplyError(e: unknown): string {
  if (e instanceof CouponUnavailableError) return e.userMessage;
  if (e && typeof e === "object" && "userMessage" in e) {
    return String((e as { userMessage: unknown }).userMessage);
  }
  // CouponRedemption.bookingRequestId فريد — سباق حقيقي (نداءان متزامنان) يصطدم هنا
  // رغم الفحص اليدوي داخل المعاملة.
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
    return "الحجز عليه كود خصم بالفعل. أعد فتح المودال وتحقق من الحالة.";
  }
  if (isSerializationConflict(e)) {
    return "ازدحام مؤقت أثناء تطبيق الكود. أعد المحاولة بعد لحظات.";
  }
  console.error(e);
  return "تعذّر تطبيق كود الخصم الآن، حاول مرة أخرى.";
}
