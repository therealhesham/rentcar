import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminEmployeeCreateForm } from "@/app/admin/(dashboard)/employees/AdminEmployeeCreateForm";
import { AdminEmployeePermissionsForm } from "@/app/admin/(dashboard)/employees/AdminEmployeePermissionsForm";
import { AdminEmployeeToggleForm } from "@/app/admin/(dashboard)/employees/AdminEmployeeToggleForm";
import { AdminEmployeeNotifyToggleForm } from "@/app/admin/(dashboard)/employees/AdminEmployeeNotifyToggleForm";
import { requireAdminPage } from "@/lib/admin-page";
import { ADMIN_PERMISSION_LABELS, type AdminPermission } from "@/lib/admin-permissions";
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
        <h1 className="text-3xl font-extrabold tracking-tight">إدارة الموظفين والصلاحيات</h1>
        <p className="mt-2 text-on-surface-variant">
          أنشئ حسابات دخول للموظفين وحدد الفروع التي يديرونها والصلاحيات الممنوحة لهم في لوحة الإدارة.
          الموظف الذي يتبع "الإدارة المركزية" يرى كافة الفروع حسب صلاحياته.
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
                    فرع: {e.branch?.name ?? "الإدارة المركزية"}{" "}
                    {e.branch?.slug ? (
                      <span className="font-mono text-on-surface-variant">({e.branch.slug})</span>
                    ) : null}
                  </p>
                  {e.permissionsJson && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {(JSON.parse(e.permissionsJson) as string[]).map((p) => (
                        <span key={p} className="rounded bg-primary-container px-2 py-0.5 text-[10px] font-bold text-on-primary-container">
                          {ADMIN_PERMISSION_LABELS[p as AdminPermission] ?? p}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <AdminEmployeePermissionsForm
                      employeeId={e.id}
                      currentPermissions={e.permissionsJson ? JSON.parse(e.permissionsJson) : []}
                    />
                    <AdminEmployeeNotifyToggleForm
                      employeeId={e.id}
                      notifyOnBookingEmail={e.notifyOnBookingEmail}
                    />
                  </div>
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
