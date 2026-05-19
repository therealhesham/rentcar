import Link from "next/link";
import { requireAdminPage } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";
import { AdminDirectBookingForm } from "./AdminDirectBookingForm";

export const dynamic = "force-dynamic";

export default async function AdminDirectBookingPage() {
  const session = await requireAdminPage();

  const fleetAtBranch = session.branchId
    ? { branchId: session.branchId, quantity: { gt: 0 } }
    : { quantity: { gt: 0 } };

  const brandsRaw = await prisma.brand
    .findMany({
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        models: {
          where: { fleetItems: { some: fleetAtBranch } },
          select: { id: true, name: true, year: true },
          orderBy: [{ name: "asc" }, { year: "desc" }],
        },
      },
    })
    .catch(() => []);

  const brands = brandsRaw
    .map((b) => ({
      id: b.id,
      name: b.name,
      models: b.models.map((m) => ({
        id: m.id,
        label: `${m.name} (${m.year})`,
      })),
    }))
    .filter((b) => b.models.length > 0);

  return (
    <>
      <header className="mb-10">
        <h1 className="text-3xl font-extrabold tracking-tight">تسجيل حجز مباشر (مكتب)</h1>
        <p className="mt-2 max-w-2xl text-on-surface-variant">
          لعميل تواصل عبر واتساب أو هاتف: اختر{" "}
          <span className="font-bold text-on-surface">الماركة</span> ثم{" "}
          <span className="font-bold text-on-surface">الموديل</span>، ثم أدخل بياناته. يُطبَّق نفس
          التوفر والأسطول كما في موقع العميل.
        </p>
        <p className="mt-3 text-sm text-on-surface-variant">
          <Link href="/admin" className="font-bold text-primary hover:underline">
            لوحة التحكم
          </Link>
          {" · "}
          <Link href="/admin/fleet-availability" className="font-bold text-primary hover:underline">
            توفر المركبات
          </Link>
          {" · "}
          <Link href="/admin/car-bookings" className="font-bold text-primary hover:underline">
            حجوزات السيارات
          </Link>
        </p>
      </header>

      <section className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-6 md:p-8">
        <AdminDirectBookingForm
          brands={brands}
          lockedBranchSlug={session.isSuperAdmin ? null : session.branchSlug}
        />
      </section>
    </>
  );
}
