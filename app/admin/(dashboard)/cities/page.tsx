import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";
import { CityCreateForm } from "@/app/admin/(dashboard)/cities/CityCreateForm";
import { CityDeleteForm } from "@/app/admin/(dashboard)/cities/CityDeleteForm";

export const dynamic = "force-dynamic";

export default async function AdminCitiesPage() {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const cities = await prisma.city
    .findMany({
      orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
      include: { _count: { select: { branches: true } } },
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
        <h1 className="text-3xl font-extrabold tracking-tight">إدارة المدن</h1>
        <p className="mt-2 text-on-surface-variant">
          أضف المدن ثم اربط كل فرع بمدينة من{" "}
          <Link href="/admin/branches" className="font-bold text-primary hover:underline">
            إدارة الفروع
          </Link>
          . يظهر في نموذج الحجز: اختيار المدينة ثم الفرع.
        </p>
      </header>

      <CityCreateForm />

      <div className="overflow-x-auto rounded-2xl border border-outline-variant/30 bg-surface-container-low">
        <table className="w-full min-w-[640px] text-start text-sm">
          <thead>
            <tr className="border-b border-outline-variant/40 bg-surface-container/80">
              <th className="px-4 py-3 font-bold">الترتيب</th>
              <th className="px-4 py-3 font-bold">الاسم</th>
              <th className="px-4 py-3 font-bold" dir="ltr">
                slug
              </th>
              <th className="px-4 py-3 font-bold">فروع</th>
              <th className="px-4 py-3 font-bold">نشط</th>
              <th className="px-4 py-3 font-bold">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {cities.length === 0 ? (
              <tr>
                <td
                  colSpan={6}
                  className="px-4 py-10 text-center text-on-surface-variant"
                >
                  لا توجد مدن بعد. أضف مدينة أعلاه.
                </td>
              </tr>
            ) : (
              cities.map((c) => (
                <tr
                  key={c.id}
                  className="border-b border-outline-variant/20 last:border-0"
                >
                  <td className="px-4 py-3 tabular-nums text-on-surface-variant">
                    {c.sortOrder}
                  </td>
                  <td className="px-4 py-3 font-medium">{c.name}</td>
                  <td
                    className="px-4 py-3 font-mono text-xs text-on-surface-variant"
                    dir="ltr"
                  >
                    {c.slug}
                  </td>
                  <td className="px-4 py-3 tabular-nums">{c._count.branches}</td>
                  <td className="px-4 py-3">{c.isActive ? "نعم" : "لا"}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <Link
                        href={`/admin/cities/${c.id}/edit`}
                        className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface-container"
                      >
                        تعديل
                      </Link>
                      <CityDeleteForm id={c.id} name={c.name} />
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
