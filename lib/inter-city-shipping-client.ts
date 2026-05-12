/** دوال آمنة للمتصفح (بدون Prisma) — معاينة رسوم الشحن في الـ checkout. */

export function lookupInterCityFeeSar(
  rules: ReadonlyArray<{ fromSlug: string; toSlug: string; feeExclVatSar: number }>,
  originSlug: string | undefined,
  destinationSlug: string | undefined,
): number {
  const from = (originSlug ?? "").trim().toLowerCase();
  const to = (destinationSlug ?? "").trim().toLowerCase();
  if (!from || !to || from === to) return 0;
  const hit = rules.find((r) => r.fromSlug === from && r.toSlug === to);
  return hit && hit.feeExclVatSar > 0 ? Math.round(hit.feeExclVatSar) : 0;
}

export function citySlugForBranchSlug(
  branchSlug: string | undefined,
  cities: ReadonlyArray<{ slug: string; branches: ReadonlyArray<{ slug: string }> }>,
): string | undefined {
  if (!branchSlug) return undefined;
  const b = branchSlug.trim().toLowerCase();
  for (const c of cities) {
    if (c.branches.some((br) => br.slug.trim().toLowerCase() === b)) {
      return c.slug.trim().toLowerCase();
    }
  }
  return undefined;
}
