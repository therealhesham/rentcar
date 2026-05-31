/**
 * ضبط مواعيد الفروع حسب جدول التشغيل.
 * تشغيل: npx tsx prisma/scripts/seed-branch-opening-hours.ts
 */
import { PrismaClient } from "@prisma/client";
import { applyBranchOpeningHoursFromSheet } from "../../lib/branch-opening-hours-seed";

const prisma = new PrismaClient();

applyBranchOpeningHoursFromSheet(prisma)
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
