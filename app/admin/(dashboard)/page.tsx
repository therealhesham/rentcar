import Link from "next/link";
import { redirect } from "next/navigation";
import { ConvertInquiryToDirectForm } from "@/components/admin/ConvertInquiryToDirectForm";
import { verifyAdminSession } from "@/lib/admin-auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage() {
  if (!(await verifyAdminSession())) {
    redirect("/admin/login");
  }

  const [
    categoriesCount,
    brandsCount,
    modelsCount,
    fleetRows,
    bookingTotal,
    bookingNew,
    bookingRequests,
    bookableModelsRaw,
  ] = await Promise.all([
    prisma.fleetCategory.count(),
    prisma.brand.count(),
    prisma.carModel.count(),
    prisma.fleet.findMany({ select: { quantity: true } }),
    prisma.bookingRequest.count(),
    prisma.bookingRequest.count({ where: { status: "NEW" } }),
    prisma.bookingRequest
      .findMany({
        orderBy: { createdAt: "desc" },
        take: 25,
        include: {
          carModel: { include: { brand: true } },
        },
      })
      .catch(() => []),
    prisma.carModel
      .findMany({
        where: { fleetItems: { some: { quantity: { gt: 0 } } } },
        select: {
          id: true,
          name: true,
          brand: { select: { name: true } },
        },
        orderBy: [{ brand: { name: "asc" } }, { name: "asc" }],
      })
      .catch(() => []),
  ]);

  const bookableModels = bookableModelsRaw.map((m) => ({
    id: m.id,
    label: `${m.brand.name} ${m.name}`,
  }));

  const fleetUnits = fleetRows.reduce((sum, row) => sum + row.quantity, 0);

  const statCards = [
    { label: "فئات الأسطول", value: categoriesCount },
    { label: "الماركات", value: brandsCount },
    { label: "موديلات مسجّلة", value: modelsCount },
    { label: "وحدات في الأسطول (مجموع الكميات)", value: fleetUnits },
    { label: "طلبات الحجز (الكل)", value: bookingTotal },
    { label: "طلبات جديدة", value: bookingNew },
  ];

  return (
    <>
      <header className="mb-10">
        <h1 className="text-3xl font-extrabold tracking-tight">لوحة التحكم</h1>
        <p className="mt-2 max-w-2xl text-on-surface-variant">
          نظرة عامة على المحتوى والطلبات. لإدارة الأسطول والتعديل على السيارات استخدم{" "}
          <Link href="/admin/vehicles" className="font-bold text-primary hover:underline">
            المركبات
          </Link>
          ، ولإدارة التصنيفات{" "}
          <Link href="/admin/categories" className="font-bold text-primary hover:underline">
            فئات الأسطول
          </Link>
          ، وللفروع وقسم «فروعنا الجديدة»{" "}
          <Link href="/admin/branches" className="font-bold text-primary hover:underline">
            الفروع
          </Link>
          ، ولصورة الهيرو في الرئيسية{" "}
          <Link href="/admin/home" className="font-bold text-primary hover:underline">
            هيرو الرئيسية
          </Link>
          ، ولعرض الحجوزات المباشرة حسب التاريخ{" "}
          <Link href="/admin/car-bookings" className="font-bold text-primary hover:underline">
            حجوزات السيارات
          </Link>
          ، وللتوفر مقابل الأسطول{" "}
          <Link href="/admin/fleet-availability" className="font-bold text-primary hover:underline">
            توفر المركبات
          </Link>
          ، ولقائمة العملاء من الطلبات{" "}
          <Link href="/admin/customers" className="font-bold text-primary hover:underline">
            العملاء
          </Link>
          ، ولتسجيل حجز مباشر نيابة عن عميل{" "}
          <Link href="/admin/direct-booking" className="font-bold text-primary hover:underline">
            حجز مباشر (مكتب)
          </Link>
          .
        </p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="rounded-2xl border border-outline-variant/30 bg-surface-container-low px-5 py-4"
          >
            <p className="text-sm font-medium text-on-surface-variant">{card.label}</p>
            <p className="mt-2 text-3xl font-extrabold tabular-nums tracking-tight">
              {card.value}
            </p>
          </div>
        ))}
      </section>

      <section className="mt-10 rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6">
        <h2 className="text-xl font-extrabold tracking-tight">آخر طلبات الحجز</h2>
        <p className="mt-1 text-sm text-on-surface-variant">
          طلب حجز من الرئيسية (استفسار) مقابل حجز مباشر بعد اختيار سيارة — يظهر النوع في العمود الأول. يمكن
          ربط طلب الاستفسار بسيارة متاحة في الأسطول وتحويله إلى حجز مباشر من عمود «تحويل».
        </p>

        {bookingRequests.length === 0 ? (
          <p className="mt-4 rounded-xl bg-surface-container px-4 py-3 text-sm text-on-surface-variant">
            لا توجد طلبات حجز حتى الآن.
          </p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full min-w-[1180px] text-start text-sm">
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
                  <th className="px-3 py-2">تحويل</th>
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
                    <td className="px-3 py-2 align-top">
                      {request.kind === "INQUIRY" ? (
                        <ConvertInquiryToDirectForm
                          bookingRequestId={request.id}
                          models={bookableModels}
                        />
                      ) : (
                        <span className="text-on-surface-variant">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
