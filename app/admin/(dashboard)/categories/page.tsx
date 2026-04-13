import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/admin-auth";
import { CategoryCreateForm } from "@/app/admin/(dashboard)/categories/CategoryCreateForm";
import { CategoryDeleteForm } from "@/app/admin/(dashboard)/categories/CategoryDeleteForm";
import { getFleetCategoriesForAdminFull } from "@/lib/fleet-category-data";

export const dynamic = "force-dynamic";

export default async function AdminCategoriesPage() {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const categories = await getFleetCategoriesForAdminFull().catch(() => []);

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-10">
        <Link
          href="/admin"
          className="mb-3 inline-block text-sm font-bold text-primary hover:underline"
        >
          ← لوحة التحكم
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight">إدارة فئات الأسطول</h1>
        <p className="mt-2 text-on-surface-variant">
          أضف أو عدّل أو احذف الفئات المعروضة في الصفحة الرئيسية وروابط التصفية. لا يمكن حذف فئة ما
          دامت مرتبطة بسيارات.
        </p>
      </header>

        <CategoryCreateForm />

        <div className="overflow-x-auto rounded-2xl border border-outline-variant/30 bg-surface-container-low">
          <table className="w-full min-w-[640px] text-start text-sm">
            <thead>
              <tr className="border-b border-outline-variant/40 bg-surface-container/80">
                <th className="px-4 py-3 font-bold">الترتيب</th>
                <th className="px-4 py-3 font-bold">العنوان</th>
                <th className="px-4 py-3 font-bold" dir="ltr">
                  slug
                </th>
                <th className="px-4 py-3 font-bold">السيارات</th>
                <th className="px-4 py-3 font-bold">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {categories.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-on-surface-variant">
                    لا توجد فئات. أضف فئة أعلاه أو نفّذ{" "}
                    <code className="rounded bg-surface-container px-1 text-xs">
                      npx prisma db seed
                    </code>
                    .
                  </td>
                </tr>
              ) : (
                categories.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-outline-variant/20 last:border-0"
                  >
                    <td className="px-4 py-3 tabular-nums text-on-surface-variant">
                      {c.sortOrder}
                    </td>
                    <td className="px-4 py-3 font-medium">{c.title}</td>
                    <td className="px-4 py-3 font-mono text-xs text-on-surface-variant" dir="ltr">
                      {c.slug}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{c._count.models}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-3">
                        <Link
                          href={`/admin/categories/${c.id}/edit`}
                          className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface-container"
                        >
                          تعديل
                        </Link>
                        <CategoryDeleteForm id={c.id} title={c.title} />
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
