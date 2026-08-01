import { prisma } from "@/lib/prisma";

/** يوحّد اسم فرع للمطابقة: يزيل «فرع» البادئة والمسافات ويصغّر الأحرف. */
export function normalizeBranchName(s: string): string {
  return s
    .trim()
    .replace(/^فرع\s+/, "")
    .toLowerCase()
    .replace(/\s+/g, "");
}

/**
 * يبني حلّال اسم فرع → id: بالاسم أولاً، ثم باسم المدينة لو المدينة بها فرع واحد.
 * `allowedBranchIds` يحصر النتائج بفروع بعينها (موظف مرتبط بفرع واحد).
 */
export async function buildBranchResolver(options?: {
  allowedBranchIds?: number[];
}): Promise<(name: string) => number | null> {
  const allowed = options?.allowedBranchIds;
  const branches = await prisma.branch.findMany({
    where: {
      isActive: true,
      ...(allowed && { id: { in: allowed } }),
    },
    select: { id: true, name: true, city: { select: { name: true } } },
  });
  const byName = new Map<string, number>();
  const cityCounts = new Map<string, number>();
  for (const b of branches) {
    byName.set(normalizeBranchName(b.name), b.id);
    if (b.city?.name) {
      const c = normalizeBranchName(b.city.name);
      cityCounts.set(c, (cityCounts.get(c) ?? 0) + 1);
    }
  }
  const byCity = new Map<string, number>();
  for (const b of branches) {
    if (!b.city?.name) continue;
    const c = normalizeBranchName(b.city.name);
    if (cityCounts.get(c) === 1) byCity.set(c, b.id);
  }
  return (name: string) => {
    const n = normalizeBranchName(name);
    if (!n) return null;
    return byName.get(n) ?? byCity.get(n) ?? null;
  };
}
