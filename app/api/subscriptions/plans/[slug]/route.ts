import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  _: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const s = slug.trim().toLowerCase();
  const plan = await prisma.subscriptionPlan.findFirst({
    where: { slug: s, isActive: true },
    include: {
      carModel: { include: { brand: true, category: true } },
    },
  });
  if (!plan) {
    return NextResponse.json({ ok: false, error: "الخطة غير موجودة." }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    plan: {
      slug: plan.slug,
      marketingTitleAr:
        plan.marketingTitleAr ?? `${plan.carModel.brand.name} ${plan.carModel.name}`,
      descriptionAr: plan.descriptionAr,
      monthlyPriceSar: plan.monthlyPriceSar,
      mileageKmPerMonth: plan.mileageKmPerMonth,
      insuranceIncluded: plan.insuranceIncluded,
      maintenanceIncluded: plan.maintenanceIncluded,
      depositAmountSar: plan.depositAmountSar,
      extraKmFeeSarPerKm: plan.extraKmFeeSarPerKm,
      durationOptionsCsv: plan.durationOptionsCsv,
      carModelVatPercent: plan.carModel.vatRatePercent,
      car: {
        name: `${plan.carModel.brand.name} ${plan.carModel.name}`.trim(),
        image: plan.carModel.image,
        alt: plan.carModel.alt,
        year: plan.carModel.year,
        categoryTitle: plan.carModel.category.title,
      },
    },
  });
}
