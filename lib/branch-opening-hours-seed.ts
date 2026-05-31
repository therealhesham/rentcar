import type { PrismaClient } from "@prisma/client";
import { BRANCH_OPENING_HOURS_SHEET_RULES } from "@/lib/branch-opening-hours-build";

/** تطبيق مواعيد الورقة على الفروع المطابقة بالاسم/slug. */
export async function applyBranchOpeningHoursFromSheet(
  prisma: PrismaClient,
): Promise<{ updated: number; skipped: { id: number; name: string; slug: string }[] }> {
  const branches = await prisma.branch.findMany({
    select: { id: true, name: true, slug: true },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
  });

  const matchedIds = new Set<number>();
  let updated = 0;

  for (const rule of BRANCH_OPENING_HOURS_SHEET_RULES) {
    const targets = branches.filter((b) => rule.match(b));
    for (const b of targets) {
      if (matchedIds.has(b.id)) continue;
      matchedIds.add(b.id);
      await prisma.branch.update({
        where: { id: b.id },
        data: { openingHoursJson: rule.openingHoursJson },
      });
      updated++;
    }
  }

  const skipped = branches.filter((b) => !matchedIds.has(b.id));
  return { updated, skipped };
}
