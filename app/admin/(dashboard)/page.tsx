import Link from "next/link";
import {
  BarChart3,
  CalendarPlus,
  Car,
  ClipboardList,
  KeyRound,
  LayoutGrid,
  MapPin,
  Shield,
  Truck,
  Users,
} from "lucide-react";
import { AdminCard } from "@/components/admin/AdminCard";
import {
  AdminDashboardBookingsSection,
  type DashboardBookingRow,
} from "@/components/admin/AdminDashboardBookingsSection";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import { adminBranchDisplayName, bookingBranchWhere } from "@/lib/admin-access";
import { requireAdminPage } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const QUICK_LINKS_ALL = [
  { href: "/admin/statistics", label: "الإحصائيات", icon: BarChart3 },
  { href: "/admin/car-bookings", label: "حجوزات السيارات", icon: ClipboardList },
  { href: "/admin/branch-returns", label: "مرتجعات الفرع", icon: Truck },
  { href: "/admin/direct-booking", label: "حجز مباشر (مكتب)", icon: CalendarPlus },
  { href: "/admin/vehicles", label: "المركبات", icon: Car },
  { href: "/admin/employees", label: "موظفو الفروع", icon: Users, superOnly: true },
  { href: "/admin/customers", label: "العملاء", icon: Users },
  { href: "/admin/fleet-availability", label: "توفر الأسطول", icon: LayoutGrid },
  { href: "/admin/booking-otp-delivery", label: "رمز التحقق", icon: KeyRound, superOnly: true },
] as const;

export default async function AdminDashboardPage() {
  const session = await requireAdminPage();
  const branchScope = (extra?: Parameters<typeof bookingBranchWhere>[1]) =>
    bookingBranchWhere(session, extra);
  const quickLinks = QUICK_LINKS_ALL.filter((l) => session.isSuperAdmin || !("superOnly" in l && l.superOnly));

  const [
    categoriesCount,
    brandsCount,
    modelsCount,
    fleetRows,
    bookingTotal,
    bookingRequests,
    bookableModelsRaw,
    fleetCategoriesForEdit,
  ] = await Promise.all([
    session.isSuperAdmin ? prisma.fleetCategory.count() : Promise.resolve(0),
    session.isSuperAdmin ? prisma.brand.count() : Promise.resolve(0),
    session.isSuperAdmin ? prisma.carModel.count() : Promise.resolve(0),
    session.isSuperAdmin
      ? prisma.fleet.findMany({ select: { quantity: true } })
      : Promise.resolve([]),
    prisma.bookingRequest.count({ where: branchScope() }),
    prisma.bookingRequest
      .findMany({
        where: branchScope(),
        orderBy: { createdAt: "desc" },
        take: 25,
        include: {
          carModel: { include: { brand: true } },
          pickupBranch: { select: { slug: true, name: true } },
          returnBranch: { select: { slug: true, name: true } },
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
    session.isSuperAdmin
      ? prisma.fleetCategory
          .findMany({
            orderBy: [{ sortOrder: "asc" }, { id: "asc" }],
            select: { slug: true, title: true },
          })
          .catch(() => [])
      : Promise.resolve([]),
  ]);

  const bookableModels = bookableModelsRaw.map((m) => ({
    id: m.id,
    label: `${m.brand.name} ${m.name}`,
  }));

  const fleetUnits = fleetRows.reduce((sum, row) => sum + row.quantity, 0);

  const dashboardRows: DashboardBookingRow[] = bookingRequests.map((request) => ({
    id: request.id,
    kind: request.kind as "INQUIRY" | "DIRECT",
    fullName: request.fullName,
    phone: request.phone,
    ageRange: request.ageRange,
    carType: request.carType,
    branch:
      request.returnBranch?.slug ?? request.pickupBranch?.slug ?? "jeddah",
    pickupMode: request.pickupMode,
    deliveryLat: request.deliveryLat,
    deliveryLng: request.deliveryLng,
    deliveryAddress:
      (request as { deliveryAddress?: string | null }).deliveryAddress ?? null,
    pickupDateYmd: request.pickupDate.toISOString().slice(0, 10),
    numberOfDays: request.numberOfDays,
    termsAccepted: request.termsAccepted,
    status: request.status,
    carModelId: request.carModelId,
    carModelLabel: request.carModel
      ? `${request.carModel.brand.name} ${request.carModel.name}`
      : null,
    addonsJson: request.addonsJson ?? null,
    paymentStatus: request.paymentStatus ?? null,
    paidAt: request.paidAt ? request.paidAt.toISOString() : null,
    paymentMethod: request.paymentMethod ?? null,
    idDocumentKind: request.idDocumentKind ?? null,
    nationalIdNumber: request.nationalIdNumber ?? null,
    passportNumber: request.passportNumber ?? null,
    licenseNumber: request.licenseNumber ?? null,
    licenseExpiryDate: request.licenseExpiryDate
      ? request.licenseExpiryDate.toISOString().slice(0, 10)
      : null,
    idCardImageUrl: request.idCardImageUrl ?? null,
    driverLicenseImageUrl: request.driverLicenseImageUrl ?? null,
    cancelledAt: request.cancelledAt ? request.cancelledAt.toISOString() : null,
    cancellationDeductedDays: request.cancellationDeductedDays ?? null,
    cancellationRefundAmountSar: request.cancellationRefundAmountSar ?? null,
    cancellationRefundExternalRef: request.cancellationRefundExternalRef ?? null,
    pickupBranchName: request.pickupBranch?.name ?? null,
    returnBranchName: request.returnBranch?.name ?? null,
    createdAtLabel: new Date(request.createdAt).toLocaleString("ar-SA"),
    pickupDateLabel: new Date(request.pickupDate).toLocaleDateString("ar-SA"),
  }));

  return (
    <>
      <AdminPageHeader
        title="لوحة التحكم"
        description={
          session.isSuperAdmin
            ? "نظرة سريعة على الطلبات والأسطول. استخدم الروابط السريعة أو القائمة الجانبية للوصول إلى أي قسم."
            : `بيانات فرع ${adminBranchDisplayName(session)} فقط. مرحباً ${session.displayName}. الحجوزات والعملاء والمركبات مرتبطة بهذا الفرع.`
        }
        backHref={undefined}
      />

      {!session.isSuperAdmin && session.branchSlug ? (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-primary/25 bg-primary-container/25 px-5 py-4 text-sm text-on-surface">
          <MapPin className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <div>
            <span className="font-bold">فرعك: </span>
            {adminBranchDisplayName(session)}
            <span className="mx-2 text-on-surface-variant">·</span>
            <span className="text-on-surface-variant">{session.displayName}</span>
          </div>
        </div>
      ) : null}

      <AdminCard className="mb-8" title="روابط سريعة" description="الوصول المباشر إلى الأقسام الأكثر استخداماً.">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 rounded-xl border border-outline-variant/20 bg-surface-container-low/30 px-4 py-3 text-sm font-bold text-on-surface transition-all hover:border-primary/30 hover:bg-primary-container/20 hover:text-primary"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-primary shadow-sm ring-1 ring-outline-variant/15">
                  <Icon className="size-4" aria-hidden />
                </span>
                {link.label}
              </Link>
            );
          })}
        </div>
      </AdminCard>

      <section className="mb-8 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <AdminStatCard label="حجوزات (الكل)" value={bookingTotal} href="/admin/car-bookings" />
        {session.isSuperAdmin ? (
          <>
            <AdminStatCard label="وحدات الأسطول" value={fleetUnits} href="/admin/vehicles" />
            <AdminStatCard label="فئات الأسطول" value={categoriesCount} href="/admin/categories" />
            <AdminStatCard label="الماركات" value={brandsCount} href="/admin/vehicles" />
            <AdminStatCard label="موديلات مسجّلة" value={modelsCount} href="/admin/vehicles" />
          </>
        ) : (
          <AdminStatCard
            label="موديلات متاحة للحجز"
            value={bookableModels.length}
            href="/admin/fleet-availability"
            hint="في نطاق فرعك"
          />
        )}
      </section>

      <AdminCard className="mt-2" noPadding>
        <div className="flex flex-col gap-1 border-b border-outline-variant/15 bg-surface-container-low/40 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
          <div>
            <h2 className="text-lg font-extrabold tracking-tight text-on-surface">آخر الحجوزات</h2>
            <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">
              أحدث 25 حجزاً مباشراً. للتفاصيل الكاملة افتح صفحة الحجز.
            </p>
          </div>
          <Link
            href="/admin/car-bookings"
            className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-outline-variant/30 bg-white px-4 py-2 text-xs font-bold text-primary shadow-sm transition-colors hover:bg-surface-container-low"
          >
            <ClipboardList className="size-3.5" aria-hidden />
            عرض كل الحجوزات
          </Link>
        </div>
        <AdminDashboardBookingsSection
          rows={dashboardRows}
          categories={fleetCategoriesForEdit}
          models={bookableModels}
        />
      </AdminCard>

      {session.isSuperAdmin ? (
        <p className="mt-6 flex items-center gap-2 text-xs text-on-surface-variant">
          <Shield className="size-3.5" aria-hidden />
          صلاحيات مدير النظام — جميع الفروع والإعدادات متاحة.
        </p>
      ) : null}
    </>
  );
}
