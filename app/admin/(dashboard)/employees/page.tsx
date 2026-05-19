import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminEmployeeCreateForm } from "@/app/admin/(dashboard)/employees/AdminEmployeeCreateForm";
import { AdminEmployeeToggleForm } from "@/app/admin/(dashboard)/employees/AdminEmployeeToggleForm";
import { requireAdminPage } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminEmployeesPage() {
  const session = await requireAdminPage();
  if (!session.isSuperAdmin) {
    redirect("/admin");
  }

  const [employees, branches] = await Promise.all([
    prisma.adminEmployee.findMany({
      orderBy: [{ isSuperAdmin: "desc" }, { createdAt: "desc" }],
      include: {
        branch: { select: { name: true, slug: true } },
      },
    }),
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      select: { id: true, name: true, slug: true },
    }),
  ]);

  const branchEmployees = employees.filter((e) => !e.isSuperAdmin);

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-10">
        <Link
          href="/admin"
          className="mb-3 inline-block text-sm font-bold text-primary hover:underline"
        >
          ← لوحة التحكم
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight">موظفو الفروع</h1>
        <p className="mt-2 text-on-surface-variant">
          أنشئ حسابات دخول مرتبطة بفرع محدد. كل موظف يرى في لوحة التحكم بيانات فرعه فقط (حجوزات،
          عملاء، مركبات، توفر).
        </p>
      </header>

      <AdminEmployeeCreateForm branches={branches} />

      <section className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest">
        <h2 className="border-b border-outline-variant/25 px-5 py-4 text-lg font-extrabold">
          الحسابات الحالية
        </h2>
        {branchEmployees.length === 0 ? (
          <p className="px-5 py-8 text-sm text-on-surface-variant">
            لا يوجد موظفو فروع بعد. أضف أول حساب من النموذج أعلاه.
          </p>
        ) : (
          <ul className="divide-y divide-outline-variant/20">
            {branchEmployees.map((e) => (
              <li
                key={e.id}
                className="flex flex-wrap items-center justify-between gap-3 px-5 py-4"
              >
                <div>
                  <p className="font-bold text-on-surface">
                    {e.name?.trim() || e.email}
                    {!e.isActive ? (
                      <span className="ms-2 rounded-full bg-error-container px-2 py-0.5 text-xs font-bold text-error">
                        معطّل
                      </span>
                    ) : null}
                  </p>
                  <p className="mt-0.5 text-sm text-on-surface-variant" dir="ltr">
                    {e.email}
                  </p>
                  <p className="mt-1 text-sm font-medium text-primary">
                    فرع: {e.branch?.name ?? "—"}{" "}
                    {e.branch?.slug ? (
                      <span className="font-mono text-on-surface-variant">({e.branch.slug})</span>
                    ) : null}
                  </p>
                </div>
                <AdminEmployeeToggleForm employeeId={e.id} isActive={e.isActive} />
              </li>
            ))}
          </ul>
        )}
      </section>

      <p className="mt-8 text-sm text-on-surface-variant">
        مدير النظام (سوبر أدمن) يُدار من متغيرات البيئة أو seed — لا يظهر هنا للتعديل.
      </p>
    </div>
  );
}
