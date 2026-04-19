import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { BranchCreateForm } from "@/app/admin/(dashboard)/branches/BranchCreateForm";
import { BranchDeleteForm } from "@/app/admin/(dashboard)/branches/BranchDeleteForm";

export const dynamic = "force-dynamic";

export default async function AdminBranchesPage() {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const branches = await prisma.branch
    .findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
    })
    .catch(() => []);

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-10">
        <Link
          href="/admin"
          className="mb-3 inline-block text-sm font-bold text-primary hover:underline"
        >
          ← لوحة التحكم
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight">إدارة الفروع</h1>
        <p className="mt-2 text-on-surface-variant">
          أضف فروع الاستلام وحدّث الـ slug ليتوافق مع قيم الحجز (مثل jeddah، madinah، tabuk). حقل
          «فروعنا الجديدة» يتحكم في ظهور الفرع في الصفحة الرئيسية.
        </p>
      </header>

      <BranchCreateForm />

      <div className="overflow-x-auto rounded-2xl border border-outline-variant/30 bg-surface-container-low">
        <table className="w-full min-w-[720px] text-start text-sm">
          <thead>
            <tr className="border-b border-outline-variant/40 bg-surface-container/80">
              <th className="px-4 py-3 font-bold">الترتيب</th>
              <th className="px-4 py-3 font-bold">الاسم</th>
              <th className="px-4 py-3 font-bold" dir="ltr">
                slug
              </th>
              <th className="px-4 py-3 font-bold">نشط</th>
              <th className="px-4 py-3 font-bold">جديد بالرئيسية</th>
              <th className="px-4 py-3 font-bold">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {branches.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-on-surface-variant"
                >
                  لا توجد فروع. أضف فرعًا أعلاه أو أنشئ جدول Branch في قاعدة البيانات ثم{" "}
                  <code className="rounded bg-surface-container px-1 text-xs">
                    npx prisma generate
                  </code>
                  .
                </td>
              </tr>
            ) : (
              branches.map((b) => (
                <tr
                  key={b.id}
                  className="border-b border-outline-variant/20 last:border-0"
                >
                  <td className="px-4 py-3 tabular-nums text-on-surface-variant">
                    {b.sortOrder}
                  </td>
                  <td className="px-4 py-3 font-medium">{b.name}</td>
                  <td
                    className="px-4 py-3 font-mono text-xs text-on-surface-variant"
                    dir="ltr"
                  >
                    {b.slug}
                  </td>
                  <td className="px-4 py-3">{b.isActive ? "نعم" : "لا"}</td>
                  <td className="px-4 py-3">{b.isNew ? "نعم" : "لا"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <Link
                        href={`/admin/branches/${b.id}/edit`}
                        className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface-container"
                      >
                        تعديل
                      </Link>
                      <BranchDeleteForm id={b.id} name={b.name} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
