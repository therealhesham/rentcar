/**
 * مزامنة حسابات الأدمن مع ملف «معلومات الادمن.xlsx».
 *
 * يعمل dry-run افتراضياً (يطبع الفروقات بلا كتابة). للتطبيق:
 *   npx tsx prisma/scripts/sync-admin-employees.ts --apply
 *
 * قواعد الملف:
 *   • «سوبر ادمن» و«كل الصلاحيات» ⇒ isSuperAdmin = true (بلا صلاحيات صفحات — العلم يتجاوزها).
 *   • «ادمن مشرف»                 ⇒ مشرف مدينة: cityId مضبوط، branchId = null، صلاحيات التشغيل.
 *   • «no»                        ⇒ الحساب يبقى نشطاً لاستقبال إيميلات CC لكن بلا أي صلاحية صفحة.
 *
 * ملاحظة: notifyGlobalTo/notifyGlobalCc لا يعملان إلا مع notifyOnBookingEmail = true — الاستعلام
 * في lib/booking-notification-email.ts يفلتر بهذا العمود أولاً. لذلك كل من يستقبل إيميلاً هنا
 * يأخذ notifyOnBookingEmail = true وتُحدَّد وجهته (TO/CC) بالمدينة أو بعلمَي TO/CC العامّين.
 *
 * لا يلمس الحسابات غير المذكورة في الملف (حسابات الفروع وحسابات النظام).
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../../lib/password";

const prisma = new PrismaClient();
const APPLY = process.argv.includes("--apply");

/** صلاحيات التشغيل اليومي — نفس المجموعة المستخدمة فعلياً لحسابات الفروع الحالية. */
const OPERATIONS_PERMISSIONS = [
  "/admin/statistics",
  "/admin/company-dues",
  "/admin/customer-dues",
  "/admin/car-bookings",
  "/admin/missed-bookings",
  "/admin/cancelled-bookings",
  "/admin/branch-returns",
  "/admin/customers",
  "/admin/direct-booking",
  "/admin/fleet-availability",
  "/admin/vehicles",
  "/admin/vehicle-units",
];

type RoleSpec = { slug: string; name: string; permissions: string[]; sortOrder: number };

/**
 * الوظائف من عمود «المسمى الوظيفي». مسميات المشرفين في الملف مرتبطة بمدينة
 * («مشرف فروع تبوك») لكن المدينة تأتي من cityId على الموظف، فالوظيفة واحدة للجميع.
 * وظائف السوبر أدمن والحسابات بلا صلاحية تُنشأ بلا صلاحيات — مسمّى للعرض فقط.
 */
const ROLES: RoleSpec[] = [
  { slug: "branch-staff", name: "موظف فرع", permissions: OPERATIONS_PERMISSIONS, sortOrder: 0 },
  { slug: "branch-supervisor", name: "مشرف فروع", permissions: OPERATIONS_PERMISSIONS, sortOrder: 1 },
  { slug: "operations-manager", name: "مدير العمليات", permissions: [], sortOrder: 2 },
  { slug: "operations-supervisor", name: "مشرف عمليات", permissions: [], sortOrder: 3 },
  { slug: "operations-officer", name: "مسئول عمليات", permissions: [], sortOrder: 4 },
  { slug: "rental-accountant", name: "محاسب التأجير", permissions: [], sortOrder: 5 },
  { slug: "finance-manager", name: "المدير المالي", permissions: [], sortOrder: 6 },
];

type EmployeeSpec = {
  email: string;
  name: string;
  roleSlug: string;
  isSuperAdmin: boolean;
  /** slug المدينة لمشرف المدينة، أو null */
  citySlug: string | null;
  permissions: string[];
  notifyOnBookingEmail: boolean;
  notifyGlobalTo: boolean;
  notifyGlobalCc: boolean;
};

const EMPLOYEES: EmployeeSpec[] = [
  {
    email: "issam.abdulaziz@rawaes.com",
    name: "عصام صالح حسن عبدالعزيز",
    roleSlug: "operations-manager",
    isSuperAdmin: true,
    citySlug: null,
    permissions: [],
    notifyOnBookingEmail: true,
    notifyGlobalTo: false,
    notifyGlobalCc: true,
  },
  {
    email: "saif.abdullah@rawaes.com",
    name: "سيف عبدالله عبدربه",
    roleSlug: "branch-supervisor",
    isSuperAdmin: false,
    citySlug: "madinah",
    permissions: OPERATIONS_PERMISSIONS,
    notifyOnBookingEmail: true,
    notifyGlobalTo: false,
    notifyGlobalCc: false,
  },
  {
    email: "tbu.almuruj.cr@rawaes.com",
    name: "حازم البلوي",
    roleSlug: "branch-supervisor",
    isSuperAdmin: false,
    citySlug: "tabuk",
    permissions: OPERATIONS_PERMISSIONS,
    notifyOnBookingEmail: true,
    notifyGlobalTo: false,
    notifyGlobalCc: false,
  },
  {
    email: "faiz.faisal@rawaes.com",
    name: "فايز الهمامي",
    roleSlug: "branch-supervisor",
    isSuperAdmin: false,
    citySlug: "jeddah",
    permissions: OPERATIONS_PERMISSIONS,
    notifyOnBookingEmail: true,
    notifyGlobalTo: false,
    notifyGlobalCc: false,
  },
  {
    email: "ynb.albuhairah.cr@rawaes.com",
    name: "عامر العرفي",
    roleSlug: "branch-supervisor",
    isSuperAdmin: false,
    citySlug: "yanbu",
    permissions: OPERATIONS_PERMISSIONS,
    notifyOnBookingEmail: true,
    notifyGlobalTo: false,
    notifyGlobalCc: false,
  },
  {
    email: "alaa.megahed@rawaes.com",
    name: "علاء مجاهد",
    roleSlug: "operations-supervisor",
    isSuperAdmin: true,
    citySlug: null,
    permissions: [],
    notifyOnBookingEmail: true,
    notifyGlobalTo: true,
    notifyGlobalCc: false,
  },
  {
    email: "ruqaya.alemam@rawaes.com",
    name: "رقية الامام",
    roleSlug: "rental-accountant",
    isSuperAdmin: false,
    citySlug: null,
    permissions: [],
    notifyOnBookingEmail: true,
    notifyGlobalTo: false,
    notifyGlobalCc: true,
  },
  {
    email: "islam.elhusseini@rawaes.com",
    name: "اسلام الحسيني",
    roleSlug: "finance-manager",
    isSuperAdmin: false,
    citySlug: null,
    permissions: [],
    notifyOnBookingEmail: true,
    notifyGlobalTo: false,
    notifyGlobalCc: true,
  },
  {
    email: "safa.kardano@rawaes.com",
    name: "صفاء كرداني",
    roleSlug: "operations-officer",
    isSuperAdmin: true,
    citySlug: null,
    permissions: [],
    notifyOnBookingEmail: true,
    notifyGlobalTo: false,
    notifyGlobalCc: true,
  },
];

/** حسابات الفروع الموجودة — تُربط بوظيفة «موظف فرع» فقط، بلا أي تغيير آخر. */
const BRANCH_STAFF_EMAILS = [
  "med.alaridh.cr@rawaes.com",
  "jed.palestine.cr@rawaes.com",
  "jed.ajawid.cr@rawaes.com",
];

function randomPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 14; i++) {
    out += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return out;
}

function samePermissions(a: string[], b: string[]): boolean {
  return a.length === b.length && [...a].sort().join("|") === [...b].sort().join("|");
}

async function main() {
  console.log(APPLY ? "=== APPLY ===" : "=== DRY RUN (بلا كتابة) ===");

  const cities = await prisma.city.findMany({ select: { id: true, slug: true, name: true } });
  const cityBySlug = new Map(cities.map((c) => [c.slug, c]));

  // ─── الوظائف ────────────────────────────────────────────────────────────────
  const roleIdBySlug = new Map<string, number>();
  for (const spec of ROLES) {
    const existing = await prisma.adminJobRole.findUnique({ where: { slug: spec.slug } });
    const permissionsJson = JSON.stringify(spec.permissions);
    if (!existing) {
      console.log(`+ وظيفة جديدة: ${spec.name} (${spec.permissions.length} صلاحية)`);
      if (APPLY) {
        const created = await prisma.adminJobRole.create({
          data: { slug: spec.slug, name: spec.name, permissionsJson, sortOrder: spec.sortOrder },
        });
        roleIdBySlug.set(spec.slug, created.id);
      }
      continue;
    }
    roleIdBySlug.set(spec.slug, existing.id);
    const changes: string[] = [];
    if (existing.name !== spec.name) changes.push(`name: ${existing.name} → ${spec.name}`);
    if (existing.permissionsJson !== permissionsJson) {
      changes.push(
        `permissions: ${JSON.parse(existing.permissionsJson ?? "[]").length} → ${spec.permissions.length}`,
      );
    }
    if (!existing.isActive) changes.push("isActive: false → true");
    if (changes.length === 0) continue;
    console.log(`~ وظيفة: ${spec.name} — ${changes.join("، ")}`);
    if (APPLY) {
      await prisma.adminJobRole.update({
        where: { id: existing.id },
        data: { name: spec.name, permissionsJson, isActive: true, sortOrder: spec.sortOrder },
      });
    }
  }

  // ─── الموظفون ───────────────────────────────────────────────────────────────
  const createdPasswords: { email: string; password: string }[] = [];

  for (const spec of EMPLOYEES) {
    const city = spec.citySlug ? cityBySlug.get(spec.citySlug) : null;
    if (spec.citySlug && !city) {
      throw new Error(`المدينة غير موجودة: ${spec.citySlug} (لـ ${spec.email})`);
    }
    const jobRoleId = roleIdBySlug.get(spec.roleSlug) ?? null;
    if (APPLY && jobRoleId == null) throw new Error(`الوظيفة غير موجودة: ${spec.roleSlug}`);

    const existing = await prisma.adminEmployee.findUnique({
      where: { email: spec.email },
      include: { branch: { select: { name: true } }, city: { select: { name: true } } },
    });

    const permissionsJson = JSON.stringify(spec.permissions);

    if (!existing) {
      const password = randomPassword();
      createdPasswords.push({ email: spec.email, password });
      console.log(
        `+ حساب جديد: ${spec.name} <${spec.email}> — ${spec.isSuperAdmin ? "سوبر أدمن" : "مشرف"}` +
          (city ? ` — مدينة ${city.name}` : ""),
      );
      if (APPLY) {
        await prisma.adminEmployee.create({
          data: {
            email: spec.email,
            passwordHash: await hashPassword(password),
            name: spec.name,
            isSuperAdmin: spec.isSuperAdmin,
            isActive: true,
            branchId: null,
            cityId: city?.id ?? null,
            jobRoleId,
            permissionsJson,
            notifyOnBookingEmail: spec.notifyOnBookingEmail,
            notifyGlobalTo: spec.notifyGlobalTo,
            notifyGlobalCc: spec.notifyGlobalCc,
          },
        });
      }
      continue;
    }

    const currentPerms: string[] = existing.permissionsJson
      ? JSON.parse(existing.permissionsJson)
      : [];
    const changes: string[] = [];
    if (existing.name !== spec.name) changes.push(`الاسم: «${existing.name ?? "—"}» → «${spec.name}»`);
    if (existing.isSuperAdmin !== spec.isSuperAdmin) {
      changes.push(`سوبر أدمن: ${existing.isSuperAdmin} → ${spec.isSuperAdmin}`);
    }
    if (existing.branchId != null) changes.push(`الفرع: «${existing.branch?.name}» → بلا فرع`);
    if (existing.cityId !== (city?.id ?? null)) {
      changes.push(`المدينة: «${existing.city?.name ?? "—"}» → «${city?.name ?? "—"}»`);
    }
    if (existing.jobRoleId !== jobRoleId) changes.push(`الوظيفة → ${spec.roleSlug}`);
    if (!samePermissions(currentPerms, spec.permissions)) {
      changes.push(`الصلاحيات الفردية: ${currentPerms.length} → ${spec.permissions.length}`);
    }
    if (existing.notifyOnBookingEmail !== spec.notifyOnBookingEmail) {
      changes.push(`إيميل الحجز: ${existing.notifyOnBookingEmail} → ${spec.notifyOnBookingEmail}`);
    }
    if (existing.notifyGlobalTo !== spec.notifyGlobalTo) {
      changes.push(`TO عام: ${existing.notifyGlobalTo} → ${spec.notifyGlobalTo}`);
    }
    if (existing.notifyGlobalCc !== spec.notifyGlobalCc) {
      changes.push(`CC عام: ${existing.notifyGlobalCc} → ${spec.notifyGlobalCc}`);
    }
    if (!existing.isActive) changes.push("مفعّل: false → true");

    if (changes.length === 0) {
      console.log(`= ${spec.name} <${spec.email}> — بلا تغيير`);
      continue;
    }
    console.log(`~ ${spec.name} <${spec.email}>`);
    for (const c of changes) console.log(`    · ${c}`);
    if (APPLY) {
      await prisma.adminEmployee.update({
        where: { id: existing.id },
        data: {
          name: spec.name,
          isSuperAdmin: spec.isSuperAdmin,
          isActive: true,
          branchId: null,
          cityId: city?.id ?? null,
          jobRoleId,
          permissionsJson,
          notifyOnBookingEmail: spec.notifyOnBookingEmail,
          notifyGlobalTo: spec.notifyGlobalTo,
          notifyGlobalCc: spec.notifyGlobalCc,
        },
      });
    }
  }

  // ─── حسابات الفروع: ربط الوظيفة فقط ─────────────────────────────────────────
  const branchStaffRoleId = roleIdBySlug.get("branch-staff") ?? null;
  for (const email of BRANCH_STAFF_EMAILS) {
    const row = await prisma.adminEmployee.findUnique({
      where: { email },
      select: { id: true, name: true, jobRoleId: true },
    });
    if (!row) {
      console.log(`! حساب فرع غير موجود: ${email}`);
      continue;
    }
    if (row.jobRoleId === branchStaffRoleId) continue;
    console.log(`~ ${row.name} <${email}> — ربط وظيفة «موظف فرع»`);
    if (APPLY) {
      await prisma.adminEmployee.update({
        where: { id: row.id },
        data: { jobRoleId: branchStaffRoleId },
      });
    }
  }

  if (createdPasswords.length > 0) {
    console.log("\n=== كلمات مرور مؤقتة للحسابات الجديدة (غيّرها بعد أول دخول) ===");
    for (const c of createdPasswords) console.log(`${c.email}  ${c.password}`);
  }

  console.log(APPLY ? "\nتم التطبيق." : "\nلم تُكتب أي تغييرات. أضف --apply للتطبيق.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
