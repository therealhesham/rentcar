import Link from "next/link";
import {
  CalendarPlus,
  Car,
  ClipboardList,
  LayoutGrid,
  Users,
} from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { adminBranchDisplayName } from "@/lib/admin-access";
import { requireAdminPage } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";
import { AdminDirectBookingForm } from "./AdminDirectBookingForm";

export const dynamic = "force-dynamic";

export default async function AdminDirectBookingPage() {
  const session = await requireAdminPage();

  const fleetAtBranch = session.branchId
    ? { branchId: session.branchId, quantity: { gt: 0 } }
    : { quantity: { gt: 0 } };

  const [brandsRaw, branches] = await Promise.all([
    prisma.brand
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
      .catch(() => []),
    prisma.branch.findMany({
      where: { isActive: true },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
      select: { slug: true, name: true },
    }),
  ]);

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

  const bookableModelCount = brands.reduce((n, b) => n + b.models.length, 0);
  const branchName = session.isSuperAdmin
    ? null
    : adminBranchDisplayName(session) || session.branchSlug;

  return (
    <>
      <AdminPageHeader
        title="حجز مباشر (مكتب)"
        description={
          <>
            ابحث عن العميل بالجوال أولاً، ثم أكمل الحجز — نفس قواعد التوفر والأسطول كما في الموقع.
            {branchName ? (
              <>
                {" "}
                الفرع الحالي:{" "}
                <span className="font-bold text-on-surface">{branchName}</span>.
              </>
            ) : null}
          </>
        }
        backHref="/admin"
        backLabel="لوحة التحكم"
        actions={
          <Link
            href="/admin/fleet-availability"
            className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/35 bg-white px-4 py-2.5 text-xs font-bold text-primary shadow-sm transition-colors hover:bg-surface-container-low"
          >
            <LayoutGrid className="h-4 w-4" aria-hidden />
            توفر الأسطول
          </Link>
        }
      />

      <div className="grid gap-8 xl:grid-cols-[1fr_300px]">
        <div className="min-w-0">
          <AdminDirectBookingForm
            brands={brands}
            branches={branches}
            lockedBranchSlug={session.isSuperAdmin ? null : session.branchSlug}
            lockedBranchName={branchName}
          />
        </div>

        <aside className="space-y-4 xl:sticky xl:top-6 xl:self-start">
          <div className="rounded-2xl border border-outline-variant/25 bg-white p-5 shadow-[0_4px_24px_-10px_rgba(28,27,27,0.1)]">
            <p className="text-[11px] font-black uppercase tracking-widest text-on-surface-variant">
              جاهز للحجز
            </p>
            <p className="mt-2 text-3xl font-extrabold tabular-nums text-[#003749]">
              {bookableModelCount}
            </p>
            <p className="mt-1 text-sm text-on-surface-variant">موديل متاح في الأسطول</p>
            <div className="mt-4 flex items-center gap-2 rounded-xl bg-[#ecfdf5] px-3 py-2 text-xs font-bold text-[#047857]">
              <Car className="h-4 w-4 shrink-0" aria-hidden />
              {brands.length} ماركة
            </div>
          </div>

          <nav className="rounded-2xl border border-outline-variant/25 bg-surface-container-low/60 p-4">
            <p className="mb-3 text-xs font-bold text-on-surface-variant">روابط سريعة</p>
            <ul className="space-y-2 text-sm">
              <li>
                <Link
                  href="/admin/car-bookings"
                  className="flex items-center gap-2 font-bold text-primary hover:underline"
                >
                  <ClipboardList className="h-4 w-4" aria-hidden />
                  حجوزات السيارات
                </Link>
              </li>
              <li>
                <Link
                  href="/admin/customers"
                  className="flex items-center gap-2 font-bold text-primary hover:underline"
                >
                  <Users className="h-4 w-4" aria-hidden />
                  العملاء
                </Link>
              </li>
              <li>
                <Link
                  href="/admin/fleet-availability"
                  className="flex items-center gap-2 font-bold text-primary hover:underline"
                >
                  <LayoutGrid className="h-4 w-4" aria-hidden />
                  توفر المركبات
                </Link>
              </li>
            </ul>
          </nav>

          <div className="rounded-2xl border border-[#bfdbfe]/50 bg-[#eff6ff] p-4 text-sm leading-relaxed text-[#1e3a5f]">
            <p className="flex items-center gap-2 font-extrabold">
              <CalendarPlus className="h-4 w-4" aria-hidden />
              نصيحة سريعة
            </p>
            <p className="mt-2 text-[13px]">
              ابحث برقم الجوال أولاً. بعد اختيار الموديل والتاريخ انتظر «متاحة» ثم سجّل الحجز.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
