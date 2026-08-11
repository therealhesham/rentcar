import { PrismaClient } from "@prisma/client";
import { shortBrowser } from "./lib/activity-funnel";

const prisma = new PrismaClient();

async function test() {
  const rawBrowserUAs = await prisma.activityLog.findMany({
    where: { userAgent: { not: null } },
    select: { userAgent: true },
    distinct: ["userAgent"],
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  const browserLabelToUAs = new Map<string, string[]>();
  for (const r of rawBrowserUAs) {
    const ua = r.userAgent as string;
    const label = shortBrowser(ua);
    if (label) {
      const list = browserLabelToUAs.get(label) ?? [];
      list.push(ua);
      browserLabelToUAs.set(label, list);
    }
  }

  console.log("Labels in map:");
  for (const label of browserLabelToUAs.keys()) {
    console.log(`'${label}'`);
  }

  const testV = "Safari — iPhone";
  console.log("Does it contain testV?", browserLabelToUAs.has(testV));
}

test().catch(console.error).finally(() => prisma.$disconnect());
