import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

function qInt(searchParams: URLSearchParams, key: string, def: number, min: number, max: number) {
  const n = Number(searchParams.get(key));
  if (!Number.isInteger(n)) return def;
  return Math.max(min, Math.min(max, n));
}

/** قائمة عمومية خطط اشتراك (مع ترقيم). */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const page = qInt(searchParams, "page", 1, 1, 10_000);
  const limit = qInt(searchParams, "limit", 12, 1, 50);
  const skip = (page - 1) * limit;

  const [total, rows] = await prisma.$transaction([
    prisma.subscriptionPlan.count({ where: { isActive: true, carModel: { id: { gt: 0 } } } }),
    prisma.subscriptionPlan.findMany({
      where: { isActive: true, carModel: { id: { gt: 0 } } },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      skip,
      take: limit,
      include: {
        carModel: { include: { brand: true } },
      },
    }),
  ]);

  return NextResponse.json({
    ok: true,
    page,
    limit,
    total,
    plans: rows.map((p) => ({
      slug: p.slug,
      marketingTitleAr: p.marketingTitleAr ?? `${p.carModel.brand.name} ${p.carModel.name}`,
      descriptionAr: p.descriptionAr,
      car: {
        name: `${p.carModel.brand.name} ${p.carModel.name}`.trim(),
        image: p.carModel.image,
        alt: p.carModel.alt,
        year: p.carModel.year,
      },
      monthlyPriceSar: p.monthlyPriceSar,
      mileageKmPerMonth: p.mileageKmPerMonth,
      insuranceIncluded: p.insuranceIncluded,
      maintenanceIncluded: p.maintenanceIncluded,
      depositAmountSar: p.depositAmountSar,
      extraKmFeeSarPerKm: p.extraKmFeeSarPerKm,
      durationOptionsCsv: p.durationOptionsCsv,
    })),
  });
}
