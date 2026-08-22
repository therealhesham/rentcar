import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  resolveBranchBasePriceForModel,
  resolveBranchMonthlyPriceForModel,
} from "@/lib/fleet-branch-stock";
import {
  resolveRentalDiscountForPeriod,
  customerDiscountLabelForActualSavings,
  type ResolvedRentalDiscount,
} from "@/lib/rental-discount";
import {
  applyPriceFloorPerDay,
  resolvePriceFloorForModel,
  type RentalPeriodKind,
} from "@/lib/min-price-floor";

export const dynamic = "force-dynamic";

/**
 * السعر الفعلي (بعد الخصم التلقائي والأرضية) لفترة تأجير معيّنة.
 *
 * لازم لأن `getCarModelForCheckout` بيحل الخصم اليومي فقط server-side وقت
 * تحميل الصفحة — أما عدد أيام «الشهري» فيتغيّر client-side (رابط `days`)،
 * وأنواع خصم زي `FIXED_DAILY` تعتمد على عدد الأيام، فلازم إعادة المطابقة هنا
 * بنفس منطق `resolveRentalDiscountForPeriod` المستخدم وقت إنشاء الحجز فعلياً.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);

  const carModelId = Number(url.searchParams.get("carModelId"));
  if (!Number.isInteger(carModelId) || carModelId < 1) {
    return NextResponse.json({ ok: false, error: "معرّف السيارة غير صالح." }, { status: 400 });
  }

  const numberOfDaysRaw = Number(url.searchParams.get("numberOfDays"));
  const numberOfDays = Number.isFinite(numberOfDaysRaw) ? Math.max(1, Math.round(numberOfDaysRaw)) : 1;

  const branchSlug = (url.searchParams.get("branchSlug") ?? "").trim().toLowerCase();
  const rentalTab = (url.searchParams.get("rentalTab") ?? "daily").trim().toLowerCase();

  const model = await prisma.carModel.findUnique({
    where: { id: carModelId },
    select: {
      brandId: true,
      price: true,
      priceMonthlyExclTax: true,
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
  const basePeriodAmount = isMonthly ? branchMonthlyPrice! : branchBasePrice;
  const toPerDay = (amount: number) => (isMonthly ? amount / numberOfDays : amount);

  const priceFloor = await resolvePriceFloorForModel(carModelId, branchRow?.id ?? null, {
    minPricePerDayExclTax: model.minPricePerDayExclTax,
    minPriceMonthlyExclTax: model.minPriceMonthlyExclTax,
  });

  const rentalDiscountResolved = await resolveRentalDiscountForPeriod(basePeriodAmount, {
    brandId: model.brandId,
    carModelId,
    branchId: branchRow?.id ?? null,
    periodKind,
    days: numberOfDays,
    priceFloor,
  });

  const basePricePerDay = toPerDay(basePeriodAmount);
  const afterDiscountPerDay = rentalDiscountResolved
    ? toPerDay(rentalDiscountResolved.discountedAmountExclTax)
    : basePricePerDay;

  const floorOutcome = applyPriceFloorPerDay(
    afterDiscountPerDay,
    basePricePerDay,
    priceFloor,
    periodKind,
    numberOfDays,
  );
  const effectivePricePerDay = floorOutcome.finalPricePerDayExclTax;

  const resolvedForLabel: ResolvedRentalDiscount | null = rentalDiscountResolved
    ? {
        originalPricePerDayExclTax: basePricePerDay,
        discountedPricePerDayExclTax: afterDiscountPerDay,
        discountPerDayExclTax: toPerDay(rentalDiscountResolved.savingsExclTax),
        displayLabelAr: rentalDiscountResolved.displayLabelAr,
        kind: rentalDiscountResolved.kind,
      }
    : null;

  return NextResponse.json({
    ok: true,
    pricePerDayExclTax: effectivePricePerDay,
    originalPricePerDayExclTax: basePricePerDay,
    discountLabelAr: customerDiscountLabelForActualSavings(
      resolvedForLabel,
      basePricePerDay - effectivePricePerDay,
    ),
  });
}
