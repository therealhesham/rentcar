import Link from "next/link";
import { redirect } from "next/navigation";
import { AdminJobRoleCreateForm } from "@/app/admin/(dashboard)/job-roles/AdminJobRoleCreateForm";
import { AdminJobRoleEditForm } from "@/app/admin/(dashboard)/job-roles/AdminJobRoleEditForm";
import { AdminJobRoleToggleForm } from "@/app/admin/(dashboard)/job-roles/AdminJobRoleToggleForm";
import { parsePermissionsJson } from "@/lib/admin-job-roles";
import { requireAdminPage } from "@/lib/admin-page";
import { ADMIN_PERMISSION_LABELS } from "@/lib/admin-permissions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminJobRolesPage() {
  const session = await requireAdminPage();
  if (!session.isSuperAdmin) {
    redirect("/admin");
  }

  const roles = await prisma.adminJobRole.findMany({
    orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    include: { _count: { select: { employees: true } } },
  });

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-10">
        <Link
          href="/admin"
          className="mb-3 inline-block text-sm font-bold text-primary hover:underline"
        >
          ← لوحة التحكم
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight">الوظائف الإدارية</h1>
        <p className="mt-2 text-on-surface-variant">
          الوظيفة قالب صلاحيات يُطبَّق على كل موظف مرتبط بها، بغض النظر عن فرعه أو مدينته.
          الصلاحيات الفعلية للموظف = صلاحيات وظيفته + أي صلاحيات فردية تُمنح له من صفحة الموظفين.
        </p>
        <p className="mt-2 rounded-xl bg-surface-container-high px-4 py-3 text-sm text-on-surface-variant">
          تعديل صلاحيات وظيفة لا يسري على الموظفين المسجّلين دخول حالياً إلا بعد تسجيل دخول جديد
          (الصلاحيات محفوظة في كوكي الجلسة).
        </p>
      </header>

      <AdminJobRoleCreateForm />

      <section className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest">
        <h2 className="border-b border-outline-variant/25 px-5 py-4 text-lg font-extrabold">
          الوظائف الحالية
        </h2>
        {roles.length === 0 ? (
          <p className="px-5 py-8 text-sm text-on-surface-variant">
            لا توجد وظائف بعد. أضف أول وظيفة من النموذج أعلاه.
          </p>
        ) : (
          <ul className="divide-y divide-outline-variant/20">
            {roles.map((role) => {
              const permissions = parsePermissionsJson(role.permissionsJson);
              return (
                <li
                  key={role.id}
                  className="flex flex-wrap items-start justify-between gap-3 px-5 py-4"
                >
                  <div>
                    <p className="font-bold text-on-surface">
                      {role.name}
                      {!role.isActive ? (
                        <span className="ms-2 rounded-full bg-error-container px-2 py-0.5 text-xs font-bold text-error">
                          معطّلة
                        </span>
                      ) : null}
                    </p>
                    <p className="mt-0.5 text-sm text-on-surface-variant">
                      {role._count.employees} موظف مرتبط · {permissions.length} صلاحية
                    </p>
                    {permissions.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {permissions.map((p) => (
                          <span
                            key={p}
                            className="rounded bg-primary-container px-2 py-0.5 text-[10px] font-bold text-on-primary-container"
                          >
                            {ADMIN_PERMISSION_LABELS[p] ?? p}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    <div className="mt-3">
                      <AdminJobRoleEditForm
                        jobRoleId={role.id}
                        name={role.name}
                        currentPermissions={permissions}
                      />
                    </div>
                  </div>
                  <AdminJobRoleToggleForm jobRoleId={role.id} isActive={role.isActive} />
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
