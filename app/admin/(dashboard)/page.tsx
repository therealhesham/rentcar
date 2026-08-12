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
  Inbox,
  AlertCircle,
  PhoneCall,
  CalendarCheck,
  CheckCircle,
  XCircle,
  Search,
  Banknote,
  CalendarX2,
} from "lucide-react";
import { AdminCard } from "@/components/admin/AdminCard";
import {
  AdminDashboardBookingsSection,
  type DashboardBookingRow,
} from "@/components/admin/AdminDashboardBookingsSection";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import { bookingBranchWhere } from "@/lib/admin-access";
import {
  adminScope,
  fleetWhereForScope,
  scopeLabel,
} from "@/lib/admin-scope";
import { requireAdminPage } from "@/lib/admin-page";
import { missedPickupCondition } from "@/lib/admin-missed-bookings";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AdminDashboardPage(props: {
  searchParams?: Promise<{ filter?: string; status?: string; q?: string }>;
}) {
  const session = await requireAdminPage();
  const scope = adminScope(session);
  const branchScope = (extra?: Parameters<typeof bookingBranchWhere>[1]) =>
    bookingBranchWhere(session, extra);

  const sp = props.searchParams ? await props.searchParams : {};
  const statusParam = sp.status || (sp.filter === "new" ? "new" : "");

  const qParam = typeof sp.q === "string" ? sp.q.trim() : "";

  let statusWhere: any = {};
  if (statusParam === "new") {
    statusWhere = { status: { in: ["NEW", "UNDER_REVIEW"] } };
  } else if (statusParam === "contacted") {
    statusWhere = { status: "CONTACTED" };
  } else if (statusParam === "confirmed") {
    statusWhere = { status: "CONFIRMED" };
  } else if (statusParam === "picked_up") {
    statusWhere = { status: "PICKED_UP" };
  } else if (statusParam === "returned_completed") {
    statusWhere = { status: { in: ["RETURNED", "COMPLETED"] } };
  } else if (statusParam === "cancelled_rejected") {
    statusWhere = { status: { in: ["CANCELLED", "REJECTED"] } };
  } else if (statusParam === "unpaid") {
    statusWhere = {
      status: { notIn: ["CANCELLED", "REJECTED"] },
      OR: [
        { paymentStatus: "PENDING", kind: "DIRECT" },
        { balanceDueAtBranchSar: { gt: 0 } },
      ],
    };
  } else if (statusParam === "missed") {
    statusWhere = {
      kind: "DIRECT",
      carModelId: { not: null },
      ...missedPickupCondition(),
    };
  }

  const qFilter: any = qParam
    ? {
        OR: [
          { fullName: { contains: qParam } },
          { phone: { contains: qParam } },
          ...(Number.isInteger(Number(qParam)) ? [{ id: Number(qParam) }] : []),
        ],
      }
    : {};

  const bookingsWhere = {
    ...branchScope(),
    ...statusWhere,
    ...qFilter,
  };

  const [
    categoriesCount,
    brandsCount,
    modelsCount,
    fleetRows,
    
    // Counts for tabs
    countAll,
    countNewUnderReview,
    countContacted,
    countConfirmed,
    countPickedUp,
    countReturnedCompleted,
    countCancelledRejected,
    countUnpaid,
    countMissed,

    bookingRequests,
    bookableModelsRaw,
    fleetCategoriesForEdit,
  ] = await Promise.all([
    scope.kind === "all" ? prisma.fleetCategory.count() : Promise.resolve(0),
    scope.kind === "all" ? prisma.brand.count() : Promise.resolve(0),
    scope.kind === "all" ? prisma.carModel.count() : Promise.resolve(0),
    prisma.fleet.findMany({
      where: fleetWhereForScope(scope),
      select: { quantity: true },
    }),
    prisma.bookingRequest.count({ where: { ...branchScope(), ...qFilter } }),
    prisma.bookingRequest.count({
      where: {
        ...branchScope(),
        status: { in: ["NEW", "UNDER_REVIEW"] },
        ...qFilter,
      },
    }),
    prisma.bookingRequest.count({
      where: {
        ...branchScope(),
        status: "CONTACTED",
        ...qFilter,
      },
    }),
    prisma.bookingRequest.count({
      where: {
        ...branchScope(),
        status: "CONFIRMED",
        ...qFilter,
      },
    }),
    prisma.bookingRequest.count({
      where: {
        ...branchScope(),
        status: "PICKED_UP",
        ...qFilter,
      },
    }),
    prisma.bookingRequest.count({
      where: {
        ...branchScope(),
        status: { in: ["RETURNED", "COMPLETED"] },
        ...qFilter,
      },
    }),
    prisma.bookingRequest.count({
      where: {
        ...branchScope(),
        status: { in: ["CANCELLED", "REJECTED"] },
        ...qFilter,
      },
    }),
    prisma.bookingRequest.count({
      where: {
        ...branchScope(),
        status: { notIn: ["CANCELLED", "REJECTED"] },
        OR: [
          { paymentStatus: "PENDING", kind: "DIRECT" },
          { balanceDueAtBranchSar: { gt: 0 } },
        ],
        ...qFilter,
      },
    }),
    prisma.bookingRequest.count({
      where: {
        ...branchScope(),
        kind: "DIRECT",
        carModelId: { not: null },
        ...missedPickupCondition(),
        ...qFilter,
      },
    }),
    prisma.bookingRequest
      .findMany({
        where: bookingsWhere,
        orderBy: { createdAt: "desc" },
        take: 100,
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
    fixedDuration: request.rentalPeriodKind?.trim().toUpperCase() === "MONTHLY",
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
    balanceDueAtBranchSar: request.balanceDueAtBranchSar ?? null,
    vehiclePlateNumber: request.vehiclePlateNumber ?? null,
    pickupBranchName: request.pickupBranch?.name ?? null,
    returnBranchName: request.returnBranch?.name ?? null,
    createdAtLabel: new Date(request.createdAt).toLocaleString("ar-SA"),
    createdAtIso: request.createdAt.toISOString(),
    pickupDateLabel: new Date(request.pickupDate).toLocaleDateString("ar-SA"),
  }));

  let cardTitle = "آخر الحجوزات";
  let cardDescription = "أحدث 100 حجز. للتفاصيل الكاملة افتح صفحة الحجز.";

  if (statusParam === "new") {
    cardTitle = "الحجوزات الجديدة وتحت المراجعة";
    cardDescription = "قائمة بالطلبات الجديدة وتحت المراجعة المعلقة والمحتاجة لمتابعة.";
  } else if (statusParam === "contacted") {
    cardTitle = "حجوزات تم التواصل معها";
    cardDescription = "الحجوزات التي تم التواصل مع أصحابها ومتابعة التفاصيل.";
  } else if (statusParam === "confirmed") {
    cardTitle = "الحجوزات المؤكدة";
    cardDescription = "الحجوزات المؤكدة وفي انتظار موعد استلام السيارة.";
  } else if (statusParam === "picked_up") {
    cardTitle = "الحجوزات النشطة (مستلمة)";
    cardDescription = "الحجوزات التي تم تسليم مركباتها للعملاء وهي نشطة حالياً.";
  } else if (statusParam === "returned_completed") {
    cardTitle = "الحجوزات المستلمة والمكتملة";
    cardDescription = "الحجوزات التي انتهت وتم إرجاع السيارة أو إكمال الإجراءات.";
  } else if (statusParam === "cancelled_rejected") {
    cardTitle = "الحجوزات الملغاة والمرفوضة";
    cardDescription = "الحجوزات التي تم إلغاؤها من قبل العميل أو رفضها من الإدارة.";
  } else if (statusParam === "unpaid") {
    cardTitle = "مبالغ مستحقة (غير مدفوعة)";
    cardDescription = "حجوزات نشطة أو مكتملة بانتظار الدفع أو يوجد عليها رصيد إضافي مستحق للفرع.";
  } else if (statusParam === "missed") {
    cardTitle = "الحجوزات الفائتة";
    cardDescription = "حجوزات لم تُستلَم سياراتها ومرّ على موعد الاستلام أكثر من 12 ساعة.";
  }

  const tabs = [
    { id: "", label: "الكل", count: countAll, icon: Inbox },
    { id: "new", label: "جديد وتحت المراجعة", count: countNewUnderReview, icon: AlertCircle },
    { id: "confirmed", label: "مؤكد", count: countConfirmed, icon: CalendarCheck },
    { id: "picked_up", label: "مستلم", count: countPickedUp, icon: KeyRound },
    { id: "missed", label: "فائتة", count: countMissed, icon: CalendarX2 },
    { id: "returned_completed", label: "مسلّم/مكتمل", count: countReturnedCompleted, icon: CheckCircle },
    { id: "unpaid", label: "مبالغ مستحقة", count: countUnpaid, icon: Banknote },
    { id: "cancelled_rejected", label: "ملغي/مرفوض", count: countCancelledRejected, icon: XCircle },
  ];

  return (
    <>
      <AdminPageHeader
        title="لوحة التحكم"
        description={
          scope.kind === "all"
            ? undefined
            : `بيانات ${scopeLabel(scope)} فقط. مرحباً ${session.displayName}. الحجوزات والعملاء والمركبات مرتبطة بهذا النطاق.`
        }
        backHref={undefined}
      />

      {scope.kind === "all" ? null : (
        <div className="mb-6 flex items-start gap-3 rounded-2xl border border-primary/25 bg-primary-container/25 px-5 py-4 text-sm text-on-surface">
          <MapPin className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
          <div>
            <span className="font-bold">نطاقك: </span>
            {scopeLabel(scope)}
            <span className="mx-2 text-on-surface-variant">·</span>
            <span className="text-on-surface-variant">{session.displayName}</span>
          </div>
        </div>
      )}


      <AdminCard className="mt-2" noPadding>
        <div className="flex flex-col gap-3 border-b border-outline-variant/15 bg-surface-container-low/40 px-5 py-4 sm:px-6">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-on-surface">
                {cardTitle}
              </h2>
              <p className="mt-1 text-sm leading-relaxed text-on-surface-variant">
                {cardDescription}
              </p>
            </div>
            {statusParam ? (
              <Link
                href="/admin"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-outline-variant/30 bg-white px-4 py-2 text-xs font-bold text-on-surface shadow-sm transition-colors hover:bg-surface-container-low"
              >
                عرض جميع الحجوزات باللوحة
              </Link>
            ) : (
              <Link
                href="/admin/car-bookings"
                className="inline-flex shrink-0 items-center gap-1.5 rounded-xl border border-outline-variant/30 bg-white px-4 py-2 text-xs font-bold text-primary shadow-sm transition-colors hover:bg-surface-container-low"
              >
                <ClipboardList className="size-3.5" aria-hidden />
                عرض كل الحجوزات
              </Link>
            )}
          </div>

          {/* Tabs Navigation */}
          <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none -mx-2 px-2 sm:mx-0 sm:px-0">
            {tabs.map((tab) => {
              const isActive = statusParam === tab.id;
              const Icon = tab.icon;
              const targetUrl = new URLSearchParams();
              if (tab.id) targetUrl.set("status", tab.id);
              if (qParam) targetUrl.set("q", qParam);

              return (
                <Link
                  key={tab.id}
                  href={`/admin?${targetUrl.toString()}`}
                  className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition-all ${
                    isActive
                      ? "bg-[#003749] text-white shadow-sm"
                      : "bg-white text-on-surface-variant hover:bg-[#eae6e2] border border-outline-variant/20"
                  }`}
                >
                  <Icon className="size-3.5" aria-hidden />
                  <span>{tab.label}</span>
                  <span
                    className={`inline-flex min-w-5 h-5 items-center justify-center rounded-full px-1 text-[10px] font-extrabold ${
                      isActive ? "bg-white/20 text-white" : "bg-outline-variant/30 text-on-surface-variant"
                    }`}
                  >
                    {tab.count}
                  </span>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Search Bar - Above Table */}
        <div className="flex items-center justify-end border-b border-outline-variant/15 bg-surface-container-lowest px-5 py-2.5 sm:px-6">
          <form action="/admin" method="GET" className="flex w-full max-w-[260px] shrink-0 items-center gap-2">
            {statusParam && <input type="hidden" name="status" value={statusParam} />}
            <div className="relative flex-1">
              <Search className="absolute right-2.5 top-1/2 size-3.5 -translate-y-1/2 text-on-surface-variant" aria-hidden />
              <input
                type="search"
                name="q"
                defaultValue={qParam}
                placeholder="بحث برقم الحجز، الجوال..."
                className="w-full rounded-lg border border-outline-variant/40 bg-white py-1.5 pe-2 ps-8 text-[11px] font-medium outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary"
              />
            </div>
            <button
              type="submit"
              className="cursor-pointer shrink-0 rounded-lg bg-surface-container-high px-3 py-1.5 text-[11px] font-bold text-on-surface transition-colors hover:bg-surface-container-highest"
            >
              بحث
            </button>
          </form>
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
