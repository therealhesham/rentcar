import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { computeCheckoutTotals } from "@/lib/booking-checkout-pricing";
import { resolveBranchBasePriceForModel } from "@/lib/fleet-branch-stock";
import {
  buildCouponDiscountLabelAr,
  computeCouponDiscountOnSubtotal,
  computeCouponDiscountPerDay,
  resolveCouponCode,
} from "@/lib/coupon-code";

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

  const resolved = await resolveCouponCode(code, { customerPhone });
  if (!resolved.ok) {
    return NextResponse.json({ ok: false, error: resolved.error }, { status: 400 });
  }
  const coupon = resolved.coupon;

  const model = await prisma.carModel.findUnique({
    where: { id: carModelId },
    select: { price: true, vatRatePercent: true },
  });
  if (!model) {
    return NextResponse.json({ ok: false, error: "السيارة غير موجودة." }, { status: 400 });
  }

  const branchRow = branchSlug
    ? await prisma.branch.findFirst({ where: { slug: branchSlug, isActive: true }, select: { id: true } })
    : null;
  const branchBasePrice = await resolveBranchBasePriceForModel(carModelId, branchRow?.id ?? null, model.price);

  if (coupon.scope === "RENTAL_ONLY") {
    const { discountedPricePerDayExclTax, discountPerDayExclTax } = computeCouponDiscountPerDay(
      branchBasePrice,
      coupon.kind,
      coupon.value,
    );
    return NextResponse.json({
      ok: true,
      scope: coupon.scope,
      discountedPricePerDayExclTax,
      discountExclTax: 0,
      labelAr: buildCouponDiscountLabelAr(coupon.kind, coupon.value, discountPerDayExclTax),
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
    branchBasePrice,
    numberOfDays,
    model.vatRatePercent,
    addons.map((a) => ({ pricePerDay: a.pricePerDay })),
    { oneTimeFeesExclTax },
  );
  const discountExclTax = computeCouponDiscountOnSubtotal(
    preDiscountTotals.subtotalExclTax,
    coupon.kind,
    coupon.value,
  );

  return NextResponse.json({
    ok: true,
    scope: coupon.scope,
    discountedPricePerDayExclTax: branchBasePrice,
    discountExclTax,
    labelAr: buildCouponDiscountLabelAr(coupon.kind, coupon.value, discountExclTax),
  });
}
