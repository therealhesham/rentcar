import Link from "next/link";
import { DeliveryDriverCreateForm } from "@/app/admin/(dashboard)/delivery-drivers/DeliveryDriverCreateForm";
import { DeliveryDriverRowActions } from "@/app/admin/(dashboard)/delivery-drivers/DeliveryDriverRowActions";
import { requireAdminPage } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminDeliveryDriversPage() {
  await requireAdminPage();

  const drivers = await prisma.deliveryDriver.findMany({
    orderBy: [{ isActive: "desc" }, { name: "asc" }],
    include: { _count: { select: { deliveryBookings: true, returnBookings: true } } },
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
        <h1 className="text-3xl font-extrabold tracking-tight">سواقو التوصيل</h1>
        <p className="mt-2 text-on-surface-variant">
          أضف السواقين هنا، ثم عيّن سواقاً لكل رحلة من صفحة تفاصيل الحجز (قسم «التوصيل»). يرى
          السواق في التطبيق اسم العميل وجواله وموقع تسليم السيارة.
        </p>
      </header>

      <DeliveryDriverCreateForm />

      <section className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest">
        <h2 className="border-b border-outline-variant/25 px-5 py-4 text-lg font-extrabold">
          السواقون الحاليون
        </h2>
        {drivers.length === 0 ? (
          <p className="px-5 py-8 text-sm text-on-surface-variant">
            لا يوجد سواقون بعد. أضف أول سواق من النموذج أعلاه.
          </p>
        ) : (
          <ul className="divide-y divide-outline-variant/20">
            {drivers.map((d) => (
              <li key={d.id} className="flex flex-wrap items-start justify-between gap-3 px-5 py-4">
                <div>
                  <p className="font-bold text-on-surface">
                    {d.name}
                    {!d.isActive ? (
                      <span className="ms-2 rounded-full bg-error-container px-2 py-0.5 text-xs font-bold text-error">
                        معطّل
                      </span>
                    ) : null}
                  </p>
                  <p dir="ltr" className="mt-0.5 text-start text-sm text-on-surface-variant">
                    {d.phone}
                  </p>
                  <p className="mt-0.5 text-xs text-on-surface-variant">
                    {d._count.deliveryBookings} تسليم · {d._count.returnBookings} استلام
                  </p>
                </div>
                <DeliveryDriverRowActions driverId={d.id} isActive={d.isActive} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
