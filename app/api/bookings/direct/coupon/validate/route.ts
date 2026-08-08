import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeCheckoutTotals } from "@/lib/booking-checkout-pricing";
import {
  resolveBranchBasePriceForModel,
  resolveBranchMonthlyPriceForModel,
} from "@/lib/fleet-branch-stock";
import { resolveRentalDiscountForPeriod } from "@/lib/rental-discount";
import {
  buildCouponDiscountLabelAr,
  computeCouponDiscountOnSubtotal,
  computeCouponDiscountForPeriod,
  resolveCouponCode,
} from "@/lib/coupon-code";
import {
  applyPriceFloorPerDay,
  capFullTotalDiscountToFloor,
  resolvePriceFloorForModel,
  NO_PRICE_FLOOR,
  type RentalPeriodKind,
} from "@/lib/min-price-floor";

export const dynamic = "force-dynamic";

/**
 * معاينة كود خصم قبل تأكيد الحجز — لا يُنشئ أي شيء ولا يحجز استخدام الكود.
 * الفاليديشن الحقيقي والمُلزِم يتكرر داخل إنشاء الحجز نفسه (createDirectBooking).
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "جسم الطلب ليس JSON صالحاً." }, { status: 400 });
  }
  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, error: "جسم الطلب فارغ." }, { status: 400 });
  }
  const obj = body as Record<string, unknown>;

  const code = String(obj.code ?? "").trim();
  if (!code) {
    return NextResponse.json({ ok: false, error: "أدخل كود الخصم." }, { status: 400 });
  }

  const localPhone = String(obj.phone ?? "").replace(/\s+/g, "").trim();
  if (!/^5\d{8}$/.test(localPhone)) {
    return NextResponse.json({ ok: false, error: "يرجى إدخال رقم الجوال أولاً." }, { status: 400 });
  }
  const customerPhone = `+966${localPhone}`;

  const carModelId = Number(obj.carModelId);
  if (!Number.isInteger(carModelId) || carModelId < 1) {
    return NextResponse.json({ ok: false, error: "معرّف السيارة غير صالح." }, { status: 400 });
  }

  const numberOfDaysRaw = Number(obj.numberOfDays);
  const numberOfDays = Number.isFinite(numberOfDaysRaw) ? Math.max(1, Math.round(numberOfDaysRaw)) : 1;

  const addonIdsRaw = obj.addonIds;
  const addonIds = Array.isArray(addonIdsRaw)
    ? addonIdsRaw.map((x) => Number(x)).filter((n) => Number.isInteger(n) && n > 0)
    : [];

  const branchSlug = String(obj.branchSlug ?? "").trim().toLowerCase();
  const rentalTab = String(obj.rentalTab ?? "daily").trim().toLowerCase();

  const model = await prisma.carModel.findUnique({
    where: { id: carModelId },
    select: {
      brandId: true,
      price: true,
      priceMonthlyExclTax: true,
      vatRatePercent: true,
      minPricePerDayExclTax: true,
      minPriceMonthlyExclTax: true,
    },
  });
  if (!model) {
    return NextResponse.json({ ok: false, error: "السيارة غير موجودة." }, { status: 400 });
  }

  const branchRow = branchSlug
    ? await prisma.branch.findFirst({ where: { slug: branchSlug, isActive: true }, select: { id: true } })
    : null;
  const branchBasePrice = await resolveBranchBasePriceForModel(carModelId, branchRow?.id ?? null, model.price);
  const branchMonthlyPrice = await resolveBranchMonthlyPriceForModel(
    carModelId,
    branchRow?.id ?? null,
    model.priceMonthlyExclTax,
  );

  const isMonthly = rentalTab === "monthly" && branchMonthlyPrice != null;
  const periodKind: RentalPeriodKind = isMonthly ? "MONTHLY" : "DAILY";

  // نفس ترتيب `createDirectBooking`: صلاحية الكود لنوع التأجير أولاً، ثم الخصم،
  // ثم أرضية السعر — وإلا يشوف العميل خصماً أعمق مما سيُطبَّق فعلاً.
  const resolved = await resolveCouponCode(code, { customerPhone, periodKind });
  if (!resolved.ok) {
    return NextResponse.json({ ok: false, error: resolved.error }, { status: 400 });
  }
  const coupon = resolved.coupon;

  // الأرضية الحقيقية للمركبة — يحتاجها خصم `TO_MIN_PRICE` ليعرف لأي رقم ينزّل،
  // ولا علاقة لها بتصريح تجاوز الكود.
  const priceFloor = await resolvePriceFloorForModel(carModelId, branchRow?.id ?? null, {
    minPricePerDayExclTax: model.minPricePerDayExclTax,
    minPriceMonthlyExclTax: model.minPriceMonthlyExclTax,
  });
  // الأرضية المفروضة عند القصّ فقط — تُلغى لكود مصرَّح له بالتجاوز.
  // خلطها بالسابقة كانت تُفقد الخصم التلقائي أرضيته فيرتفع السعر بدل أن ينخفض.
  const enforcedFloor = coupon.canBypassMinPrice ? NO_PRICE_FLOOR : priceFloor;

  const basePeriodAmount = isMonthly ? branchMonthlyPrice! : branchBasePrice;
  const toPerDay = (amount: number) => (isMonthly ? amount / numberOfDays : amount);

  // الخصم التلقائي أولاً — الكود يُطبَّق فوق السعر الظاهر للعميل، مش على السعر
  // الأساسي. نفس ترتيب `createDirectBooking` بالضبط.
  const rentalDiscountResolved = await resolveRentalDiscountForPeriod(basePeriodAmount, {
    brandId: model.brandId,
    carModelId,
    branchId: branchRow?.id ?? null,
    periodKind,
    days: numberOfDays,
    priceFloor,
  });
  const afterRentalDiscount =
    rentalDiscountResolved?.discountedAmountExclTax ?? basePeriodAmount;
  // «السعر الأساسي» في المعاينة = السعر الظاهر للعميل قبل الكود.
  const basePricePerDay = toPerDay(afterRentalDiscount);

  if (coupon.scope === "RENTAL_ONLY") {
    const { discountedAmountExclTax } = computeCouponDiscountForPeriod(
      afterRentalDiscount,
      coupon.kind,
      coupon.value,
      periodKind,
    );
    const floorOutcome = applyPriceFloorPerDay(
      toPerDay(discountedAmountExclTax),
      basePricePerDay,
      enforcedFloor,
      periodKind,
      numberOfDays,
    );
    const effectiveDiscountPerDay =
      Math.round((basePricePerDay - floorOutcome.finalPricePerDayExclTax) * 100) / 100;
    if (effectiveDiscountPerDay <= 0) {
      return NextResponse.json(
        { ok: false, error: "لا يمكن تطبيق هذا الكود على هذا السعر." },
        { status: 400 },
      );
    }
    return NextResponse.json({
      ok: true,
      scope: coupon.scope,
      discountedPricePerDayExclTax: floorOutcome.finalPricePerDayExclTax,
      discountExclTax: 0,
      labelAr: buildCouponDiscountLabelAr(coupon.kind, coupon.value, effectiveDiscountPerDay),
    });
  }

  const addons =
    addonIds.length > 0
      ? await prisma.rentalAddon.findMany({
          where: { id: { in: addonIds }, isActive: true },
          select: { pricePerDay: true },
        })
      : [];
  const checkoutFees = await prisma.checkoutOneTimeFee.findMany({
    where: { isActive: true },
    select: { feeExclVatSar: true },
  });
  const oneTimeFeesExclTax = checkoutFees.reduce((s, f) => s + f.feeExclVatSar, 0);

  const preDiscountTotals = computeCheckoutTotals(
    basePricePerDay,
    numberOfDays,
    model.vatRatePercent,
    addons.map((a) => ({ pricePerDay: a.pricePerDay })),
    { oneTimeFeesExclTax },
  );
  const requestedDiscount = computeCouponDiscountOnSubtotal(
    preDiscountTotals.subtotalExclTax,
    coupon.kind,
    coupon.value,
  );
  // الأرضية تحمي بند الإيجار — نفس السقف المطبَّق وقت الحجز.
  const floorPerDay =
    periodKind === "MONTHLY"
      ? enforcedFloor.minPriceMonthlyExclTax != null
        ? enforcedFloor.minPriceMonthlyExclTax / numberOfDays
        : null
      : enforcedFloor.minPricePerDayExclTax;
  const { discountExclTax } = capFullTotalDiscountToFloor(
    requestedDiscount,
    preDiscountTotals.subtotalExclTax,
    floorPerDay,
    numberOfDays,
  );

  if (discountExclTax <= 0) {
    return NextResponse.json(
      { ok: false, error: "لا يمكن تطبيق هذا الكود على هذا السعر." },
      { status: 400 },
    );
  }

  return NextResponse.json({
    ok: true,
    scope: coupon.scope,
    discountedPricePerDayExclTax: basePricePerDay,
    discountExclTax,
    labelAr: buildCouponDiscountLabelAr(coupon.kind, coupon.value, discountExclTax),
  });
}
