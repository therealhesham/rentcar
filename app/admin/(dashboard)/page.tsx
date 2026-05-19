import Link from "next/link";
import { ConvertInquiryToDirectForm } from "@/components/admin/ConvertInquiryToDirectForm";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminKindBadge, AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import { EditBookingRequestForm } from "@/components/admin/EditBookingRequestForm";
import { RevertDirectToInquiryForm } from "@/components/admin/RevertDirectToInquiryForm";
import { adminBranchDisplayName, bookingBranchWhere } from "@/lib/admin-access";
import { requireAdminPage } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

const QUICK_LINKS_ALL = [
  { href: "/admin/statistics", label: "الإحصائيات" },
  { href: "/admin/car-bookings", label: "حجوزات السيارات" },
  { href: "/admin/branch-returns", label: "مرتجعات الفرع" },
  { href: "/admin/direct-booking", label: "حجز مباشر (مكتب)" },
  { href: "/admin/vehicles", label: "المركبات" },
  { href: "/admin/employees", label: "موظفو الفروع", superOnly: true },
  { href: "/admin/customers", label: "العملاء" },
  { href: "/admin/fleet-availability", label: "توفر الأسطول" },
  { href: "/admin/booking-otp-delivery", label: "رمز التحقق", superOnly: true },
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
    bookingNew,
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
    prisma.bookingRequest.count({ where: branchScope({ status: "NEW" }) }),
    prisma.bookingRequest
      .findMany({
        where: branchScope(),
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
        <div className="mb-6 rounded-2xl border border-primary/25 bg-primary-container/25 px-5 py-4 text-sm text-on-surface">
          <span className="font-bold">فرعك: </span>
          {adminBranchDisplayName(session)}
          <span className="mx-2 text-on-surface-variant">·</span>
          <span className="text-on-surface-variant">{session.displayName}</span>
        </div>
      ) : null}

      <section className="mb-8 flex flex-wrap gap-2">
        {quickLinks.map((link) => (
          <Link
            key={link.href}
            href={link.href}
            className="rounded-full border border-outline-variant/30 bg-white px-4 py-2 text-xs font-bold text-on-surface shadow-sm transition-colors hover:border-primary/35 hover:bg-primary-container/25"
          >
            {link.label}
          </Link>
        ))}
      </section>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <AdminStatCard
          label="طلبات جديدة"
          value={bookingNew}
          href="/admin/car-bookings"
          highlight={bookingNew > 0}
          hint={bookingNew > 0 ? "تحتاج متابعة" : undefined}
        />
        <AdminStatCard label="طلبات الحجز (الكل)" value={bookingTotal} href="/admin/car-bookings" />
        <AdminStatCard label="وحدات الأسطول" value={fleetUnits} href="/admin/vehicles" />
        <AdminStatCard label="فئات الأسطول" value={categoriesCount} href="/admin/categories" />
        <AdminStatCard label="الماركات" value={brandsCount} href="/admin/vehicles" />
        <AdminStatCard label="موديلات مسجّلة" value={modelsCount} href="/admin/vehicles" />
      </section>

      <AdminCard
        className="mt-10"
        title="آخر طلبات الحجز"
        description="استفسار من الرئيسية أو حجز مباشر بعد اختيار سيارة. حوّل الاستفسار إلى حجز مباشر أو عدّل البيانات من الأعمدة."
        noPadding
      >
        {bookingRequests.length === 0 ? (
          <p className="px-6 py-10 text-center text-sm text-on-surface-variant">
            لا توجد طلبات حجز حتى الآن.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1260px] text-start text-sm">
              <thead>
                <tr className="border-b border-outline-variant/20 bg-surface-container-low/60 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
                  <th className="px-4 py-3">تعديل</th>
                  <th className="px-4 py-3">النوع</th>
                  <th className="px-4 py-3">السيارة</th>
                  <th className="px-4 py-3">الاسم</th>
                  <th className="px-4 py-3">الجوال</th>
                  <th className="px-4 py-3">العمر</th>
                  <th className="px-4 py-3">الفئة</th>
                  <th className="px-4 py-3">الفرع</th>
                  <th className="px-4 py-3">بداية الحجز</th>
                  <th className="px-4 py-3">الأيام</th>
                  <th className="px-4 py-3">الحالة</th>
                  <th className="px-4 py-3">وقت الإرسال</th>
                  <th className="px-4 py-3">تحويل / إرجاع</th>
                </tr>
              </thead>
              <tbody>
                {bookingRequests.map((request, i) => (
                  <tr
                    key={request.id}
                    className={`border-b border-outline-variant/10 transition-colors hover:bg-surface-container-low/50 ${
                      i % 2 === 1 ? "bg-surface-container-low/25" : ""
                    }`}
                  >
                    <td className="px-4 py-3 align-top">
                      <EditBookingRequestForm
                        request={{
                          id: request.id,
                          kind: request.kind,
                          fullName: request.fullName,
                          phone: request.phone,
                          ageRange: request.ageRange,
                          carType: request.carType,
                          branch: request.branch,
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
                          cancelledAt: request.cancelledAt
                            ? request.cancelledAt.toISOString()
                            : null,
                          cancellationDeductedDays: request.cancellationDeductedDays ?? null,
                          cancellationRefundAmountSar: request.cancellationRefundAmountSar ?? null,
                          cancellationRefundExternalRef:
                            request.cancellationRefundExternalRef ?? null,
                        }}
                        categories={fleetCategoriesForEdit}
                        models={bookableModels}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <AdminKindBadge kind={request.kind} />
                    </td>
                    <td className="px-4 py-3 text-on-surface-variant">
                      {request.carModel
                        ? `${request.carModel.brand.name} ${request.carModel.name}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3 font-semibold">{request.fullName}</td>
                    <td className="px-4 py-3 tabular-nums" dir="ltr">
                      {request.phone}
                    </td>
                    <td className="px-4 py-3">{request.ageRange}</td>
                    <td className="px-4 py-3">{request.carType}</td>
                    <td className="px-4 py-3">{request.branch}</td>
                    <td className="px-4 py-3 tabular-nums">
                      {new Date(request.pickupDate).toLocaleDateString("ar-SA")}
                    </td>
                    <td className="px-4 py-3 tabular-nums">{request.numberOfDays}</td>
                    <td className="px-4 py-3">
                      <AdminStatusBadge status={request.status} />
                    </td>
                    <td className="px-4 py-3 text-xs text-on-surface-variant tabular-nums">
                      {new Date(request.createdAt).toLocaleString("ar-SA")}
                    </td>
                    <td className="px-4 py-3 align-top">
                      {request.kind === "INQUIRY" ? (
                        <ConvertInquiryToDirectForm
                          bookingRequestId={request.id}
                          models={bookableModels}
                        />
                      ) : (
                        <RevertDirectToInquiryForm bookingRequestId={request.id} />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </AdminCard>
    </>
  );
}
