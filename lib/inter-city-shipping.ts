import { prisma } from "@/lib/prisma";

const CITY_SLUG_RE = /^[a-z0-9-]{1,64}$/;

/** لقطة تُخزَّن في `addonsJson` مع الإضافات لصفحة الدفع. */
export type InterCityShippingSnap = {
  fromCitySlug: string;
  toCitySlug: string;
  feeExclVatSar: number;
  labelAr: string;
};

export async function getActiveInterCityShippingRules(): Promise<
  Array<{ fromSlug: string; toSlug: string; feeExclVatSar: number }>
> {
  const rows = await prisma.interCityShippingFee.findMany({
    where: { isActive: true },
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    select: {
      feeExclVatSar: true,
      fromCity: { select: { slug: true } },
      toCity: { select: { slug: true } },
    },
  });
  return rows.map((r) => ({
    fromSlug: r.fromCity.slug.trim().toLowerCase(),
    toSlug: r.toCity.slug.trim().toLowerCase(),
    feeExclVatSar: r.feeExclVatSar,
  }));
}

/**
 * رسوم شحن لمرة واحدة (غير شامل الضريبة) عندما تختلف مدينة الاستلام/التوصيل عن مدينة فرع الإرجاع.
 * يُحدَّد اتجاه «من → إلى» من الإدارة (صفحة رسوم الشحن بين المدن).
 */
export async function resolveInterCityShippingSnap(input: {
  originCitySlug: string | null | undefined;
  returnBranchSlug: string;
}): Promise<InterCityShippingSnap | null> {
  const fromRaw = (input.originCitySlug ?? "").trim().toLowerCase();
  if (!fromRaw || !CITY_SLUG_RE.test(fromRaw)) return null;

  const branch = await prisma.branch.findFirst({
    where: { slug: input.returnBranchSlug.trim().toLowerCase(), isActive: true },
    include: { city: { select: { slug: true, name: true, isActive: true } } },
  });
  if (!branch?.city?.isActive) return null;

  const toSlug = branch.city.slug.trim().toLowerCase();
  if (fromRaw === toSlug) return null;

  const row = await prisma.interCityShippingFee.findFirst({
    where: {
      isActive: true,
      fromCity: { slug: fromRaw, isActive: true },
      toCity: { slug: toSlug, isActive: true },
    },
    include: {
      fromCity: { select: { name: true } },
      toCity: { select: { name: true } },
    },
  });
  if (!row || row.feeExclVatSar <= 0) return null;

  const fromName = row.fromCity.name.trim();
  const toName = row.toCity.name.trim();
  return {
    fromCitySlug: fromRaw,
    toCitySlug: toSlug,
    feeExclVatSar: row.feeExclVatSar,
    labelAr: `رسوم شحن بين المدن (${fromName} → ${toName})`,
  };
}
