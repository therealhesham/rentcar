import Link from "next/link";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { BookingImportClient } from "./BookingImportClient";
import { requireAdminPage } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function BookingImportPage() {
  // الوصول محكوم بصلاحية `/admin/car-bookings/import` المستقلة في middleware — مش وراثة
  // من `/admin/car-bookings`، عشان صلاحية عرض الحجوزات متديش ترحيلاً جماعياً بالغلط.
  await requireAdminPage();

  const [branches, models] = await Promise.all([
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.carModel.findMany({
      orderBy: [{ brand: { name: "asc" } }, { name: "asc" }, { year: "asc" }],
      select: { id: true, name: true, year: true, brand: { select: { name: true } } },
    }),
  ]);

  const modelOptions = models.map((m) => ({
    id: m.id,
    label: `${m.brand.name} ${m.name} ${m.year}`,
  }));

  return (
    <>
      <AdminPageHeader
        title="ترحيل حجوزات من Excel"
        backHref="/admin/car-bookings"
        backLabel="طلبات حجز السيارات"
        description={
          <>
            لنقل الحجوزات <span className="font-bold text-on-surface">التاريخية</span> من
            النظام القديم. المبالغ تُحفظ كما هي في الملف بدون إعادة تسعير، والتواريخ الماضية
            مقبولة. للحجوزات الجديدة الفعّالة استخدم{" "}
            <Link
              href="/admin/direct-booking"
              className="font-bold text-primary underline underline-offset-2"
            >
              حجز مباشر
            </Link>{" "}
            لأنه يتحقق من توفّر الأسطول ويحسب السعر الصحيح.
          </>
        }
      />

      <BookingImportClient branches={branches} models={modelOptions} />
    </>
  );
}
