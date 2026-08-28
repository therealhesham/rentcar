import React, { Fragment } from "react";
import Link from "next/link";
import { ArrowLeft, Calendar, Car, Phone, User, CreditCard } from "lucide-react";
import { AdminStatusBadge, AdminPaymentBadge } from "@/components/admin/AdminStatusBadge";
import { EditBookingRequestForm } from "@/components/admin/EditBookingRequestForm";
import { BookingListQuickActions } from "@/components/admin/BookingListQuickActions";
import { AdminQuickPaymentModal } from "@/components/admin/AdminQuickPaymentModal";
import { BookingRowActionsDropdown } from "@/components/admin/BookingRowActionsDropdown";

/** بداية اليوم التقويمي بتوقيت الرياض — لتجميع «اليوم/الأمس» بنفس التوقيت المعروض. */
const RIYADH_YMD_FMT = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Riyadh" });

function riyadhDayStart(d: Date): Date {
  return new Date(`${RIYADH_YMD_FMT.format(d)}T00:00:00.000Z`);
}

export type DashboardBookingRow = {
  id: number;
  kind: "INQUIRY" | "DIRECT";
  fullName: string;
  phone: string;
  ageRange: string;
  carType: string;
  branch: string;
  pickupMode: string | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  deliveryAddress: string | null;
  pickupIso: string;
  dropoffIso: string;
  numberOfDays: number;
  /** حجز شهري: المدة ثابتة — لا يُسمح بتغييرها. */
  fixedDuration: boolean;
  isDailyRental: boolean;
  rentalPricePerDayExclTax: number | null;
  termsAccepted: boolean;
  status: string;
  carModelId: number | null;
  carModelLabel: string | null;
  addonsJson: string | null;
  paymentStatus: string | null;
  paidAt: string | null;
  paymentMethod: string | null;
  /** مرجع جيديا — وجوده يميّز الدفع أونلاين عن التسجيل اليدوي في الفرع. */
  paymentGatewayRef: string | null;
  /** مؤرشف: مخفي عن العميل وعن الأقسام المالية، ويظهر في تبويب «مؤرشفة» وحده. */
  isHidden: boolean;
  idDocumentKind: string | null;
  nationalIdNumber: string | null;
  passportNumber: string | null;
  licenseNumber: string | null;
  licenseExpiryDate: string | null;
  idCardImageUrl: string | null;
  driverLicenseImageUrl: string | null;
  cancelledAt: string | null;
  cancellationDeductedDays: number | null;
  cancellationRefundAmountSar: number | null;
  cancellationRefundExternalRef: string | null;
  balanceDueAtBranchSar: number | null;
  vehiclePlateNumber?: string | null;
  pickupBranchName: string | null;
  returnBranchName: string | null;
  createdAtLabel: string;
  createdAtIso: string;
  pickupDateLabel: string;
};

type Props = {
  rows: DashboardBookingRow[];
  categories: { slug: string; title: string }[];
  models: { id: number; label: string }[];
  /** الأرشفة لمدير النظام وحده — الخادم يتحقق منها أيضاً. */
  canArchive?: boolean;
};

function editRequestPayload(request: DashboardBookingRow) {
  return {
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
    deliveryAddress: request.deliveryAddress,
    pickupIso: request.pickupIso,
    dropoffIso: request.dropoffIso,
    numberOfDays: request.numberOfDays,
    fixedDuration: request.fixedDuration,
    isDailyRental: request.isDailyRental,
    rentalPricePerDayExclTax: request.rentalPricePerDayExclTax,
    termsAccepted: request.termsAccepted,
    status: request.status,
    carModelId: request.carModelId,
    carModelLabel: request.carModelLabel,
    addonsJson: request.addonsJson,
    paymentStatus: request.paymentStatus,
    paidAt: request.paidAt,
    paymentMethod: request.paymentMethod,
    idDocumentKind: request.idDocumentKind,
    nationalIdNumber: request.nationalIdNumber,
    passportNumber: request.passportNumber,
    licenseNumber: request.licenseNumber,
    licenseExpiryDate: request.licenseExpiryDate,
    idCardImageUrl: request.idCardImageUrl,
    driverLicenseImageUrl: request.driverLicenseImageUrl,
    cancelledAt: request.cancelledAt,
    cancellationDeductedDays: request.cancellationDeductedDays,
    cancellationRefundAmountSar: request.cancellationRefundAmountSar,
    cancellationRefundExternalRef: request.cancellationRefundExternalRef,
    balanceDueAtBranchSar: request.balanceDueAtBranchSar,
    vehiclePlateNumber: request.vehiclePlateNumber,
  };
}

export function AdminDashboardBookingsSection({
  rows,
  categories,
  models,
  canArchive = false,
}: Props) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 px-6 py-14 text-center">
        <div className="grid size-14 place-items-center rounded-2xl bg-surface-container-low text-on-surface-variant">
          <Calendar className="size-7" aria-hidden />
        </div>
        <div>
          <p className="font-bold text-on-surface">لا توجد حجوزات حتى الآن</p>
          <p className="mt-1 text-sm text-on-surface-variant">
            ستظهر الحجوزات المباشرة هنا فور تسجيلها.
          </p>
        </div>
        <Link
          href="/admin/direct-booking"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:opacity-95"
        >
          حجز مباشر من المكتب
        </Link>
      </div>
    );
  }

  const groups = [
    { title: "حجوزات اليوم", rows: [] as DashboardBookingRow[] },
    { title: "حجوزات الأمس", rows: [] as DashboardBookingRow[] },
    { title: "الأسبوع الماضي", rows: [] as DashboardBookingRow[] },
    { title: "أقدم من ذلك", rows: [] as DashboardBookingRow[] },
  ];

  const today = riyadhDayStart(new Date());

  rows.forEach((r) => {
    const dDay = riyadhDayStart(new Date(r.createdAtIso));
    const diffTime = today.getTime() - dDay.getTime();
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 0) groups[0].rows.push(r);
    else if (diffDays === 1) groups[1].rows.push(r);
    else if (diffDays >= 2 && diffDays <= 7) groups[2].rows.push(r);
    else groups[3].rows.push(r);
  });

  return (
    <>
      {/* Mobile cards */}
      <div className="md:hidden">
        {groups.map((group) => {
          if (group.rows.length === 0) return null;
          return (
            <div key={group.title}>
              <div className="bg-primary/10 px-4 py-2.5 text-sm font-extrabold text-primary border-y border-primary/20">
                {group.title}
              </div>
              <ul className="divide-y divide-outline-variant/15">
        {rows.map((request) => (
          <li key={request.id} className="px-4 py-4">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap gap-2">
                  <AdminStatusBadge status={request.status} />
                  <AdminPaymentBadge
                    paymentStatus={request.paymentStatus}
                    paymentMethod={request.paymentMethod}
                    balanceDueAtBranchSar={request.balanceDueAtBranchSar}
                    paymentGatewayRef={request.paymentGatewayRef}
                  />
                  {request.balanceDueAtBranchSar && request.balanceDueAtBranchSar > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-md bg-error-container/20 px-2 py-0.5 text-[10px] font-bold text-error border border-error/20">
                      مستحق: {request.balanceDueAtBranchSar} ر.س
                    </span>
                  ) : null}
                </div>
                <p className="mt-2 font-extrabold text-on-surface">
                  <span className="text-on-surface-variant font-medium me-1 text-[13px]">#{request.id}</span>
                  {request.fullName}
                </p>
                <p className="mt-0.5 flex items-center gap-1.5 text-sm text-on-surface-variant">
                  <Phone className="size-3.5 shrink-0" aria-hidden />
                  <span dir="ltr" className="tabular-nums">
                    {request.phone}
                  </span>
                </p>
              </div>
              <Link
                href={`/admin/bookings/${request.id}`}
                className="shrink-0 rounded-lg bg-primary-container/50 px-3 py-1.5 text-xs font-bold text-primary"
              >
                التفاصيل
              </Link>
            </div>

            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex items-start gap-2">
                <Car className="mt-0.5 size-4 shrink-0 text-on-surface-variant" aria-hidden />
                <div>
                  <dt className="sr-only">السيارة</dt>
                  <dd className="font-semibold text-on-surface">
                    {request.carModelLabel ?? "—"}
                  </dd>
                  <dd className="text-xs text-on-surface-variant">
                    {request.pickupDateLabel} · {request.numberOfDays} يوم{" "}
                    <span
                      className={`ms-1 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                        request.fixedDuration
                          ? "bg-primary/10 text-primary"
                          : "bg-surface-container-low text-on-surface-variant"
                      }`}
                    >
                      {request.fixedDuration ? "شهري" : "يومي"}
                    </span>
                  </dd>
                </div>
              </div>
              <div className="text-xs text-on-surface-variant">
                استلام: {request.pickupBranchName ?? "—"} · إرجاع:{" "}
                {request.returnBranchName ?? "—"}
              </div>
              <div className="text-[11px] text-on-surface-variant">{request.createdAtLabel}</div>
            </dl>

            {request.status !== "CANCELLED" && request.status !== "REJECTED" && (
              <div className="mt-3 border-t border-outline-variant/10 pt-3 flex justify-end">
                <BookingRowActionsDropdown
                  request={editRequestPayload(request)}
                  paymentStatus={request.paymentStatus}
                  categories={categories}
                  models={models}
                  isMobile
                  canArchive={canArchive}
                  isHidden={request.isHidden}
                />
              </div>
            )}
          </li>
        ))}
              </ul>
            </div>
          );
        })}
      </div>

      {/* Desktop table */}
      <div className="hidden overflow-x-auto lg:overflow-visible pb-32 md:block">
        <table className="w-full min-w-[880px] text-start text-sm">
          <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
            <tr className="border-b border-outline-variant/20 bg-surface-container-low/80 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
              <th className="px-4 py-3">العميل</th>
              <th className="px-4 py-3">السيارة</th>
              <th className="px-4 py-3">الاستلام</th>
              <th className="px-4 py-3">الأيام</th>
              <th className="px-4 py-3">الحالة</th>
              <th className="px-4 py-3">إضافة الحجز</th>
              <th className="px-4 py-3">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {groups.map((group) => {
              if (group.rows.length === 0) return null;
              return (
                <Fragment key={group.title}>
                  <tr className="border-b border-primary/20 bg-primary/5">
                    <td colSpan={7} className="px-4 py-3 text-sm font-extrabold text-primary">
                      {group.title}
                    </td>
                  </tr>
                  {group.rows.map((request, i) => (
                    <tr
                      key={request.id}
                      className={`border-b border-outline-variant/10 transition-colors hover:bg-surface-container-low/50 ${
                        i % 2 === 1 ? "bg-surface-container-low/25" : ""
                      }`}
                    >
                      <td className="px-4 py-3 align-top">
                        <Link
                          href={`/admin/bookings/${request.id}`}
                          className="group block min-w-[140px]"
                        >
                          <span className="flex items-center gap-1.5 font-semibold text-on-surface group-hover:text-primary">
                            <User className="size-3.5 shrink-0 text-on-surface-variant" aria-hidden />
                            <span>
                              <span className="text-on-surface-variant font-medium me-1 text-xs">#{request.id}</span>
                              {request.fullName}
                            </span>
                          </span>
                          <span className="mt-0.5 block tabular-nums text-xs text-on-surface-variant" dir="ltr">
                            {request.phone}
                          </span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 align-top text-on-surface-variant">
                        {request.carModelLabel ?? "—"}
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className="block tabular-nums">{request.pickupDateLabel}</span>
                        <span className="mt-0.5 block text-xs text-on-surface-variant">
                          {request.pickupBranchName ?? "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <span className="block tabular-nums">{request.numberOfDays}</span>
                        <span
                          className={`mt-1 inline-block rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                            request.fixedDuration
                              ? "bg-primary/10 text-primary"
                              : "bg-surface-container-low text-on-surface-variant"
                          }`}
                        >
                          {request.fixedDuration ? "شهري" : "يومي"}
                        </span>
                      </td>
                      <td className="px-4 py-3 align-top">
                        <div className="flex flex-col items-start gap-1.5">
                          <AdminStatusBadge status={request.status} />
                          <AdminPaymentBadge
                            paymentStatus={request.paymentStatus}
                            paymentMethod={request.paymentMethod}
                            balanceDueAtBranchSar={request.balanceDueAtBranchSar}
                            paymentGatewayRef={request.paymentGatewayRef}
                          />
                          {request.balanceDueAtBranchSar && request.balanceDueAtBranchSar > 0 ? (
                            <span className="inline-flex items-center gap-1 rounded-md bg-error-container/20 px-2 py-0.5 text-[10px] font-bold text-error border border-error/20">
                              مستحق: {request.balanceDueAtBranchSar} ر.س
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-4 py-3 align-top text-xs text-on-surface-variant tabular-nums">
                        {request.createdAtLabel}
                      </td>
                      <td className="px-4 py-3 align-top text-end">
                        {request.status !== "CANCELLED" && request.status !== "REJECTED" ? (
                          <BookingRowActionsDropdown
                            request={editRequestPayload(request)}
                            paymentStatus={request.paymentStatus}
                            categories={categories}
                            models={models}
                            canArchive={canArchive}
                            isHidden={request.isHidden}
                          />
                        ) : (
                          <span className="text-xs text-on-surface-variant">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
