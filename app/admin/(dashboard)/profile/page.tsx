import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { requireAdminPage } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";
import { AdminPasswordForm } from "./AdminPasswordForm";

export const dynamic = "force-dynamic";

export default async function AdminProfilePage() {
  const session = await requireAdminPage();

  const employee =
    session.employeeId == null
      ? null
      : await prisma.adminEmployee.findUnique({
          where: { id: session.employeeId },
          select: { email: true, name: true },
        });

  return (
    <>
      <AdminPageHeader
        title="ملفي الشخصي"
        description="بيانات حسابك في لوحة الإدارة، وتغيير كلمة المرور الخاصة بك أنت فقط."
        backHref="/admin"
      />

      <dl className="mb-6 grid max-w-xl gap-3 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-6 text-sm">
        <div className="flex justify-between gap-4">
          <dt className="text-on-surface-variant">الاسم</dt>
          <dd className="font-bold">{employee?.name?.trim() || session.displayName}</dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-on-surface-variant">البريد الإلكتروني (اسم الدخول)</dt>
          <dd className="font-bold" dir="ltr">
            {employee?.email ?? "—"}
          </dd>
        </div>
        <div className="flex justify-between gap-4">
          <dt className="text-on-surface-variant">النطاق</dt>
          <dd className="font-bold">
            {session.isSuperAdmin
              ? "مدير النظام"
              : session.branchName || session.cityName || "الإدارة المركزية"}
          </dd>
        </div>
      </dl>

      {employee == null ? (
        <p className="mb-4 max-w-xl rounded-xl bg-error-container/30 px-4 py-3 text-sm font-bold text-error">
          أنت مسجّل دخول بحساب مدير النظام المعرَّف في بيئة الخادم (ADMIN_EMAIL / ADMIN_PASSWORD)،
          وهو ليس موظفاً في قاعدة البيانات — كلمة مروره تُغيَّر من إعدادات الخادم وليس من هنا.
        </p>
      ) : null}

      <AdminPasswordForm editable={employee != null} />
    </>
  );
}
