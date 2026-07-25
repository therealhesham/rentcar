import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/admin-auth";
import { BrandCreateForm } from "@/app/admin/(dashboard)/brands/BrandCreateForm";
import { BrandDeleteForm } from "@/app/admin/(dashboard)/brands/BrandDeleteForm";
import { getFleetBrandsForAdminFull } from "@/lib/brand-data";

export const dynamic = "force-dynamic";

export default async function AdminBrandsPage() {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const brands = await getFleetBrandsForAdminFull().catch(() => []);

  return (
    <div className="mx-auto max-w-4xl" dir="rtl">
      <header className="mb-8">
        <Link
          href="/admin"
          className="mb-3 inline-block text-sm font-bold text-primary hover:underline"
        >
          ← لوحة التحكم
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight">إدارة البراندات (الماركات)</h1>
        <p className="mt-2 text-on-surface-variant text-sm">
          أضف أو عدّل الماركات المسجّلة في الأسطول. يمكنك ضبط الاسم بالعربي والإنجليزي لكل براند. لا يمكن حذف براند مرتبط بسيارات.
        </p>
      </header>

      <BrandCreateForm />

      <div className="overflow-x-auto rounded-2xl border border-outline-variant/30 bg-surface-container-low">
        <table className="w-full min-w-[640px] text-start text-sm">
          <thead>
            <tr className="border-b border-outline-variant/40 bg-surface-container/80 text-on-surface-variant">
              <th className="px-4 py-3 font-bold">الماركة (عربي / أساسي)</th>
              <th className="px-4 py-3 font-bold" dir="ltr">
                Name (English)
              </th>
              <th className="px-4 py-3 font-bold">السيارات المرتبطة</th>
              <th className="px-4 py-3 font-bold">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {brands.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-10 text-center text-on-surface-variant">
                  لا توجد ماركات مسجلة بعد. أضف ماركة أعلاه.
                </td>
              </tr>
            ) : (
              brands.map((b) => (
                <tr
                  key={b.id}
                  className="border-b border-outline-variant/20 last:border-0 hover:bg-surface-container/40"
                >
                  <td className="px-4 py-3 font-bold text-on-surface">{b.name}</td>
                  <td className="px-4 py-3 font-medium text-on-surface-variant" dir="ltr">
                    {b.nameEn || <span className="text-gray-400 italic">غير محدد</span>}
                  </td>
                  <td className="px-4 py-3 tabular-nums font-semibold">{b._count.models} سيارة</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <Link
                        href={`/admin/brands/${b.id}/edit`}
                        className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface-container"
                      >
                        تعديل
                      </Link>
                      <BrandDeleteForm id={b.id} name={b.name} modelCount={b._count.models} />
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
