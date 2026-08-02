import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();
(async () => {
  const [emps, cities, branches] = await Promise.all([
    p.adminEmployee.findMany({
      orderBy: { id: "asc" },
      include: { branch: { select: { name: true, slug: true } }, city: { select: { name: true } } },
    }),
    p.city.findMany({ orderBy: { id: "asc" }, select: { id: true, name: true, slug: true, isActive: true } }),
    p.branch.findMany({ orderBy: { id: "asc" }, select: { id: true, name: true, slug: true, cityId: true, isActive: true } }),
  ]);
  console.log("=== CITIES ===");
  for (const c of cities) console.log(c.id, c.name, c.slug, c.isActive);
  console.log("=== BRANCHES ===");
  for (const b of branches) console.log(b.id, b.name, b.slug, "city:", b.cityId, b.isActive);
  console.log("=== ADMIN EMPLOYEES ===");
  for (const e of emps) {
    console.log(JSON.stringify({
      id: e.id, email: e.email, name: e.name, super: e.isSuperAdmin, active: e.isActive,
      branch: e.branch?.name ?? null, city: e.city?.name ?? null,
      notifyOnBooking: e.notifyOnBookingEmail, globalTo: e.notifyGlobalTo, globalCc: e.notifyGlobalCc,
      perms: e.permissionsJson ? JSON.parse(e.permissionsJson).length : 0,
    }, null, 0));
  }
  await p.$disconnect();
})();
