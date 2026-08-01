/**
 * ترحيل صلاحيات الموظفين من الفئات العريضة القديمة (FLEET, BOOKINGS, ...) لصلاحيات
 * الصفحة الواحدة الجديدة (href الصفحة نفسه). لازم يشتغل مرة واحدة بعد نشر نظام
 * الصلاحيات الجديد، وإلا كل الموظفين (غير سوبر أدمن) هيفقدوا وصولهم فجأة.
 *
 * تشغيل:
 *   npx tsx prisma/scripts/migrate-employee-permissions-to-pages.ts
 *   npx tsx prisma/scripts/migrate-employee-permissions-to-pages.ts --dry-run
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/** الفئات القديمة كانت بتغطي الصفحات دي — خريطة ثابتة (القيم القديمة اتلغت من الكود). */
const OLD_CATEGORY_TO_PAGES: Record<string, string[]> = {
  DASHBOARD: ["/admin/statistics", "/admin/logs"],
  FINANCIALS: ["/admin/financials", "/admin/company-dues", "/admin/customer-dues", "/admin/ledger"],
  BOOKINGS: [
    "/admin/car-bookings",
    "/admin/missed-bookings",
    "/admin/cancelled-bookings",
    "/admin/branch-returns",
    "/admin/late-returns",
    "/admin/customers",
    "/admin/direct-booking",
    "/admin/fleet-availability",
    "/admin/bookings",
  ],
  CORPORATE_LEADS: ["/admin/corporate-leads"],
  CONTENT: [
    "/admin/home",
    "/admin/promo-banner",
    "/admin/rental-pricing-display",
    "/admin/booking-otp-delivery",
    "/admin/booking-widget-tabs",
    "/admin/payment-methods",
    "/admin/payment-icons",
    "/admin/whatsapp-templates",
  ],
  FLEET: [
    "/admin/vehicles",
    "/admin/vehicle-units",
    "/admin/fleet-visibility",
    "/admin/categories",
    "/admin/brands",
    "/admin/rental-addons",
    "/admin/rental-discounts",
    "/admin/coupon-codes",
    "/admin/cities",
    "/admin/branches",
    "/admin/inter-city-shipping",
    "/admin/checkout-fees",
  ],
  SUBSCRIPTIONS: ["/admin/subscription-plans", "/admin/subscriptions"],
  POLICY: ["/admin/cancellation-policy", "/admin/rental-terms"],
  EMPLOYEES: ["/admin/employees"],
  // قدرة خاصة، مش مرتبطة بصفحة — تفضل زي ما هي.
  CANCEL_OVERRIDE: ["CANCEL_OVERRIDE"],
};

function expandOldPermissions(oldPermissions: string[]): string[] {
  const expanded = new Set<string>();
  for (const old of oldPermissions) {
    for (const page of OLD_CATEGORY_TO_PAGES[old] ?? []) {
      expanded.add(page);
    }
  }
  return [...expanded];
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const employees = await prisma.adminEmployee.findMany({
    where: { isSuperAdmin: false },
    select: { id: true, email: true, permissionsJson: true },
  });

  console.log(`${employees.length} موظف (غير سوبر أدمن) — ${dryRun ? "معاينة فقط (dry-run)" : "سيتم التحديث"}\n`);

  for (const emp of employees) {
    let oldPermissions: string[] = [];
    try {
      oldPermissions = emp.permissionsJson ? JSON.parse(emp.permissionsJson) : [];
    } catch {
      console.warn(`⚠ ${emp.email}: permissionsJson غير صالح، تم تجاهله.`);
      continue;
    }

    const newPermissions = expandOldPermissions(oldPermissions);
    console.log(`${emp.email}: [${oldPermissions.join(", ")}] → [${newPermissions.join(", ")}]`);

    if (!dryRun) {
      await prisma.adminEmployee.update({
        where: { id: emp.id },
        data: { permissionsJson: JSON.stringify(newPermissions) },
      });
    }
  }

  console.log(`\n${dryRun ? "انتهت المعاينة — أعد التشغيل بدون --dry-run للتطبيق الفعلي." : "تم الترحيل."}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
