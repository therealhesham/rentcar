import Link from "next/link";
import { redirect } from "next/navigation";
import { verifyAdminSession } from "@/lib/admin-auth";
import { AdminAddCarForm } from "@/app/admin/AdminAddCarForm";
import { LogoutButton } from "@/app/admin/LogoutButton";
import { getFleetCategoriesForAdminSelect } from "@/lib/fleet-category-data";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const [categories, bookingRequests] = await Promise.all([
    getFleetCategoriesForAdminSelect().catch(() => []),
    prisma.bookingRequest
      .findMany({
        orderBy: { createdAt: "desc" },
        take: 50,
        include: {
          carModel: { include: { brand: true } },
        },
      })
      .catch(() => []),
  ]);

  return (
    <div className="min-h-screen bg-surface px-6 py-16 text-on-surface">
      <div className="mx-auto max-w-5xl">
        <header className="mb-10 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              لوحة الإدارة
            </h1>
            <p className="mt-2 text-on-surface-variant">
              أضف مركبات لتظهر في صفحة{" "}
              <Link href="/fleet" className="font-bold text-primary hover:underline">
                الأسطول
              </Link>
              . كل مركبة مرتبطة بفئة للاستعلام والتصفية.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              href="/admin/categories"
              className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-bold text-primary transition-colors hover:bg-surface-container"
            >
              إدارة الفئات
            </Link>
            <Link
              href="/fleet"
              className="rounded-xl border border-outline-variant px-4 py-2 text-sm font-bold text-primary transition-colors hover:bg-surface-container"
            >
              عرض الأسطول
            </Link>
            <LogoutButton />
          </div>
        </header>

        <AdminAddCarForm categories={categories} />

        <section className="mt-10 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6">
          <h2 className="text-xl font-extrabold tracking-tight">طلبات الحجز الواردة</h2>
          <p className="mt-1 text-sm text-on-surface-variant">
            طلب حجز من الرئيسية (استفسار) مقابل حجز مباشر بعد اختيار سيارة — يظهر النوع في العمود الأول.
          </p>

          {bookingRequests.length === 0 ? (
            <p className="mt-4 rounded-xl bg-surface-container px-4 py-3 text-sm text-on-surface-variant">
              لا توجد طلبات حجز حتى الآن.
            </p>
          ) : (
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[1000px] text-start text-sm">
                <thead>
                  <tr className="border-b border-outline-variant/30 text-on-surface-variant">
                    <th className="px-3 py-2">النوع</th>
                    <th className="px-3 py-2">السيارة</th>
                    <th className="px-3 py-2">الاسم</th>
                    <th className="px-3 py-2">الجوال</th>
                    <th className="px-3 py-2">العمر</th>
                    <th className="px-3 py-2">الفئة</th>
                    <th className="px-3 py-2">الفرع</th>
                    <th className="px-3 py-2">بداية الحجز</th>
                    <th className="px-3 py-2">الأيام</th>
                    <th className="px-3 py-2">الحالة</th>
                    <th className="px-3 py-2">وقت الإرسال</th>
                  </tr>
                </thead>
                <tbody>
                  {bookingRequests.map((request) => (
                    <tr key={request.id} className="border-b border-outline-variant/20">
                      <td className="px-3 py-2">
                        {request.kind === "DIRECT" ? "حجز مباشر" : "طلب حجز"}
                      </td>
                      <td className="px-3 py-2 text-on-surface-variant">
                        {request.carModel
                          ? `${request.carModel.brand.name} ${request.carModel.name}`
                          : "—"}
                      </td>
                      <td className="px-3 py-2 font-medium">{request.fullName}</td>
                      <td className="px-3 py-2" dir="ltr">
                        {request.phone}
                      </td>
                      <td className="px-3 py-2">{request.ageRange}</td>
                      <td className="px-3 py-2">{request.carType}</td>
                      <td className="px-3 py-2">{request.branch}</td>
                      <td className="px-3 py-2">
                        {new Date(request.pickupDate).toLocaleDateString("ar-SA")}
                      </td>
                      <td className="px-3 py-2">{request.numberOfDays}</td>
                      <td className="px-3 py-2">{request.status}</td>
                      <td className="px-3 py-2">
                        {new Date(request.createdAt).toLocaleString("ar-SA")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
