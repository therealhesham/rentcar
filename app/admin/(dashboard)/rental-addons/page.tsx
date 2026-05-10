import Link from "next/link";
import { redirect } from "next/navigation";
import { RentalAddonCreateForm } from "@/app/admin/(dashboard)/rental-addons/RentalAddonCreateForm";
import { RentalAddonDeleteForm } from "@/app/admin/(dashboard)/rental-addons/RentalAddonDeleteForm";
import { verifyAdminSession } from "@/lib/admin-auth";
import { getRentalAddonsForAdmin } from "@/lib/rental-addon-admin-data";

export const dynamic = "force-dynamic";

export default async function AdminRentalAddonsPage() {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const addons = await getRentalAddonsForAdmin();

  return (
    <div className="mx-auto max-w-4xl">
      <header className="mb-10">
        <Link href="/admin" className="mb-3 inline-block text-sm font-bold text-primary hover:underline">
          ← لوحة التحكم
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight">إضافات التأجير</h1>
        <p className="mt-2 text-on-surface-variant">
          أضف أو عدّل الخيارات الاختيارية في صفحة إتمام الحجز (السعر لكل يوم غير شامل ضريبة القيمة المضافة).
          يمكن تعطيل الإضافة دون حذفها بإلغاء «مفعّلة للعرض».
        </p>
      </header>

      <RentalAddonCreateForm />

      <div className="overflow-x-auto rounded-2xl border border-outline-variant/30 bg-surface-container-low">
        <table className="w-full min-w-[720px] text-start text-sm">
          <thead>
            <tr className="border-b border-outline-variant/40 bg-surface-container/80">
              <th className="px-4 py-3 font-bold">الترتيب</th>
              <th className="px-4 py-3 font-bold">العنوان</th>
              <th className="px-4 py-3 font-bold" dir="ltr">
                slug
              </th>
              <th className="px-4 py-3 font-bold">سعر/يوم</th>
              <th className="px-4 py-3 font-bold">حالة</th>
              <th className="px-4 py-3 font-bold">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {addons.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-on-surface-variant">
                  لا توجد إضافات. أضف إضافة أعلاه أو نفّذ سكربت SQL في{" "}
                  <code className="rounded bg-surface-container px-1 text-xs">prisma/manual/rental_addon_mysql.sql</code>
                  .
                </td>
              </tr>
            ) : (
              addons.map((a) => (
                <tr key={a.id} className="border-b border-outline-variant/20 last:border-0">
                  <td className="px-4 py-3 tabular-nums text-on-surface-variant">{a.sortOrder}</td>
                  <td className="px-4 py-3 font-medium">{a.titleAr}</td>
                  <td className="px-4 py-3 font-mono text-xs text-on-surface-variant" dir="ltr">
                    {a.slug}
                  </td>
                  <td className="px-4 py-3 tabular-nums" dir="ltr">
                    {a.pricePerDay}
                  </td>
                  <td className="px-4 py-3">
                    {a.isActive ? (
                      <span className="rounded-full bg-primary-container/50 px-2 py-0.5 text-xs font-bold text-on-primary-container">
                        نشط
                      </span>
                    ) : (
                      <span className="rounded-full bg-outline-variant/40 px-2 py-0.5 text-xs font-bold text-on-surface-variant">
                        معطّل
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <Link
                        href={`/admin/rental-addons/${a.id}/edit`}
                        className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface-container"
                      >
                        تعديل
                      </Link>
                      <RentalAddonDeleteForm id={a.id} titleAr={a.titleAr} />
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
