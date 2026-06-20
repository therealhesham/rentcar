import Link from "next/link";
import {
  ArrowLeftRight,
  Ban,
  Calendar,
  Car,
  CreditCard,
  ExternalLink,
  Mail,
  MapPin,
  Package,
  Phone,
  Receipt,
  Settings,
  User,
} from "lucide-react";
import type { ReactNode } from "react";
import { AdminKindBadge, AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { SarAmountWithSymbol } from "@/components/ui/SarAmountWithSymbol";
import { formatSarAmount } from "@/lib/booking-checkout-pricing";
import { BookingAddonsSnapshot } from "@/components/admin/BookingAddonsSnapshot";
import { BookingAttachmentsPanel } from "@/components/admin/BookingAttachmentsPanel";
import { BookingCancelPanel } from "@/components/admin/BookingCancelPanel";
import { BookingLifecyclePanel } from "@/components/admin/BookingLifecyclePanel";
import { BookingDetailSection } from "@/components/admin/BookingDetailSection";
import type { AdminBookingCancellationContext } from "@/lib/admin-booking-cancellation";
import type { AdminBookingDetail } from "@/lib/admin-booking-detail";
import { isInterBranchPickupReturn } from "@/lib/booking-branches";
import { bookingPaymentMethodLabelAr } from "@/lib/booking-payment-method-label";
import { resolveBookingKycForDisplay } from "@/lib/booking-kyc-display";
import { formatReturnDateAr } from "@/lib/booking-return-schedule";
import { addDaysToYmd } from "@/lib/direct-booking";
import { StatementActionsDropdown } from "@/app/admin/(dashboard)/bookings/[id]/statement/StatementActionsDropdown";

function paymentStatusLabelAr(ps: string): string {
  const k = ps.trim().toUpperCase();
  if (k === "PAID") return "مدفوع";
  if (k === "REFUNDED") return "مسترد بالكامل";
  if (k === "PARTIAL_REFUND") return "استرداد جزئي";
  if (k === "NO_REFUND") return "بدون استرداد";
  return "بانتظار الدفع";
}

function paymentStatusStyles(ps: string): string {
  const k = ps.trim().toUpperCase();
  if (k === "PAID") return "bg-emerald-50 text-emerald-900 ring-emerald-200/60";
  if (k === "REFUNDED") return "bg-sky-50 text-sky-900 ring-sky-200/60";
  if (k === "PARTIAL_REFUND") return "bg-violet-50 text-violet-900 ring-violet-200/60";
  if (k === "NO_REFUND") return "bg-neutral-100 text-neutral-800 ring-neutral-200/60";
  return "bg-amber-50 text-amber-950 ring-amber-200/60";
}

function formatPickupDateTime(d: Date): string {
  return d.toLocaleString("ar-SA", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Riyadh",
  });
}

function DetailRow({
  label,
  children,
  mono,
}: {
  label: string;
  children: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
      <dt className="shrink-0 text-xs font-bold text-on-surface-variant">{label}</dt>
      <dd
        className={[
          "text-sm font-semibold text-on-surface",
          mono ? "font-mono tabular-nums sm:text-end" : "sm:text-end",
        ].join(" ")}
        dir={mono ? "ltr" : undefined}
      >
        {children}
      </dd>
    </div>
  );
}


type Props = {
  booking: AdminBookingDetail;
  editActions?: ReactNode;
  cancellation: AdminBookingCancellationContext;
};

export function BookingDetailView({ booking, editActions, cancellation }: Props) {
  const kycAttachments = resolveBookingKycForDisplay(booking, booking.customer);

  const pickupYmd = booking.pickupDate.toISOString().slice(0, 10);
  const returnYmd = addDaysToYmd(pickupYmd, booking.numberOfDays);
  const carLabel = booking.carModel
    ? `${booking.carModel.brand.name} ${booking.carModel.name}`
    : booking.carType;
  const carImage = booking.carModel?.image?.trim() || null;
  const pickupName =
    booking.pickupBranch?.name ?? (booking.pickupMode === "DELIVERY" ? "توصيل للعميل" : "—");
  const returnName = booking.returnBranch?.name ?? "—";
  const statusKeyUpper = booking.status.trim().toUpperCase();
  const isTerminalStatus =
    statusKeyUpper === "CANCELLED" || statusKeyUpper === "REJECTED";
  const balanceDueAtBranch =
    !isTerminalStatus && typeof booking.balanceDueAtBranchSar === "number"
      ? booking.balanceDueAtBranchSar
      : 0;
  const interBranch =
    booking.kind === "DIRECT" &&
    isInterBranchPickupReturn({
      branchId: booking.branchId,
      returnBranchId: booking.returnBranchId,
      pickupMode: booking.pickupMode,
      addonsJson: booking.addonsJson,
      pickupBranch: booking.pickupBranch,
      returnBranch: booking.returnBranch,
    });

  const headerActions = (
    <div className="flex flex-wrap items-center gap-2">
      {booking.kind === "DIRECT" ? (
        <Link
          href={`/admin/bookings/${booking.id}/finance`}
          className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/30 bg-white px-4 py-2.5 text-sm font-bold text-on-surface shadow-sm transition-colors hover:bg-surface-container-low"
        >
          <Receipt className="h-4 w-4 text-emerald-700" aria-hidden />
          العمليات المالية
        </Link>
      ) : null}
      {/* {booking.kind === "DIRECT" ? (
        <Link
          href={`/fleet/payment/${booking.id}`}
          target="_blank"
          className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/30 bg-white px-4 py-2.5 text-sm font-bold text-on-surface shadow-sm transition-colors hover:bg-surface-container-low"
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          صفحة الدفع
        </Link>
      ) : null} */}
      {/* <Link
        href={`/admin/bookings/${booking.id}?edit=1`}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary shadow-sm transition-opacity hover:opacity-95"
      >
        تعديل الطلب
      </Link> */}
    </div>
  );

  return (
    <div className="mx-auto max-w-6xl">
      <AdminPageHeader
        backHref="/admin/car-bookings"
        backLabel="حجوزات السيارات"
        title={`حجز #${booking.id}`}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-on-surface">{booking.fullName}</span>
            <span className="text-on-surface-variant">·</span>
            <span dir="ltr" className="font-mono text-xs tabular-nums">
              {booking.phone}
            </span>
          </span>
        }
        actions={
          <div className="flex items-center gap-2">
            {headerActions}
            {booking.kind === "DIRECT" ? (
              <StatementActionsDropdown bookingId={booking.id} printViaNavigation={true} />
            ) : null}
          </div>
        }
      />

      {/* Hero summary */}
      <div className="mb-8 rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <AdminKindBadge kind={booking.kind} />
              <AdminStatusBadge status={booking.status} />
              {booking.kind === "DIRECT" ? (
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${paymentStatusStyles(booking.paymentStatus)}`}
                >
                  {paymentStatusLabelAr(booking.paymentStatus)}
                </span>
              ) : null}
            </div>

            <div>
              <h2 className="text-xl font-bold text-[#003749] sm:text-2xl">
                {carLabel} {booking.carModel?.year ? `(${booking.carModel.year})` : ""}
              </h2>
              {booking.carModel?.year ? (
                <p className="mt-0.5 text-sm text-on-surface-variant">
                  {booking.carModel.category.title}
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm font-medium text-on-surface-variant">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 shrink-0" aria-hidden />
                <span>
                  {booking.numberOfDays} {booking.numberOfDays === 1 ? "يوم" : "أيام"}
                  {" · "}
                  {formatReturnDateAr(pickupYmd)} إلى {formatReturnDateAr(returnYmd)}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 shrink-0" aria-hidden />
                <span>
                  {booking.pickupMode === "DELIVERY" ? "توصيل للعميل" : "استلام من الفرع"}
                </span>
              </div>
            </div>
          </div>
        </div>

        {booking.kind === "DIRECT" ? (
          <div className="mt-5 border-t border-outline-variant/20 pt-5">
            <div className="flex flex-wrap items-center gap-3 text-sm font-semibold text-on-surface">
              <span className="text-on-surface-variant">استلام:</span>
              <span className="text-primary">{pickupName}</span>
              <ArrowLeftRight className="mx-1 h-4 w-4 text-on-surface-variant/50" aria-hidden />
              <span className="text-on-surface-variant">إرجاع:</span>
              <span className="text-primary">{returnName}</span>
            </div>

            {interBranch ? (
              <p className="mt-3 flex items-center gap-2 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs font-bold text-amber-950">
                <ArrowLeftRight className="h-4 w-4 shrink-0" aria-hidden />
                استلام من فرع وإرجاع لفرع آخر — راجع المرتجعات لتأكيد تحويل المخزون
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,22rem)] lg:items-start">
        {/* Main column */}
        <div className="space-y-6">
          <BookingDetailSection icon={User} title="العميل">
            <dl className="space-y-3.5">
              <DetailRow label="الاسم">{booking.fullName}</DetailRow>
              <DetailRow label="الجوال" mono>
                <a
                  href={`tel:${booking.phone}`}
                  className="inline-flex items-center gap-1.5 text-primary hover:underline"
                >
                  <Phone className="h-3.5 w-3.5" aria-hidden />
                  {booking.phone}
                </a>
              </DetailRow>
              {booking.contactEmail ? (
                <DetailRow label="البريد" mono>
                  <a
                    href={`mailto:${booking.contactEmail}`}
                    className="inline-flex max-w-full items-center gap-1.5 truncate text-primary hover:underline"
                  >
                    <Mail className="h-3.5 w-3.5 shrink-0" aria-hidden />
                    <span className="truncate">{booking.contactEmail}</span>
                  </a>
                </DetailRow>
              ) : null}
              <DetailRow label="الفئة العمرية">{booking.ageRange}</DetailRow>
              {booking.customer ? (
                <DetailRow label="حساب مسجّل">
                  <span className="block text-end text-xs leading-relaxed">
                    {booking.customer.name ?? "—"}
                    <br />
                    <span dir="ltr">{booking.customer.email}</span>
                  </span>
                </DetailRow>
              ) : null}
            </dl>
          </BookingDetailSection>

          {booking.pickupMode === "DELIVERY" &&
            (booking.deliveryAddress?.trim() ||
              (booking.deliveryLat != null && booking.deliveryLng != null)) ? (
            <BookingDetailSection
              icon={MapPin}
              title="التوصيل"
              description="عنوان وموقع استلام العميل"
            >
              {booking.deliveryAddress?.trim() ? (
                <p className="whitespace-pre-wrap rounded-xl bg-surface-container-low/60 px-4 py-3 text-sm leading-relaxed">
                  {booking.deliveryAddress.trim()}
                </p>
              ) : null}
              {booking.deliveryLat != null && booking.deliveryLng != null ? (
                <a
                  href={`https://www.google.com/maps?q=${booking.deliveryLat},${booking.deliveryLng}`}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary hover:opacity-95"
                >
                  <MapPin className="h-4 w-4" aria-hidden />
                  فتح على الخريطة
                  <span className="font-mono text-xs opacity-90" dir="ltr">
                    {booking.deliveryLat.toFixed(5)}, {booking.deliveryLng.toFixed(5)}
                  </span>
                </a>
              ) : null}
            </BookingDetailSection>
          ) : null}

          {booking.kind === "DIRECT" && booking.addonsJson ? (
            <BookingDetailSection
              icon={Receipt}
              title="الإضافات والرسوم"
              description="لقطة الأسعار عند إنشاء الحجز"
            >
              <BookingAddonsSnapshot raw={booking.addonsJson} />
            </BookingDetailSection>
          ) : null}

          {booking.kind === "DIRECT" ? (
            <BookingDetailSection icon={CreditCard} title="الدفع">
              <dl className="space-y-3.5">
                <DetailRow label="الحالة">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ring-1 ring-inset ${paymentStatusStyles(booking.paymentStatus)}`}
                  >
                    {paymentStatusLabelAr(booking.paymentStatus)}
                  </span>
                </DetailRow>
                {booking.paymentMethod ? (
                  <DetailRow label="الطريقة">
                    {bookingPaymentMethodLabelAr(booking.paymentMethod)}
                  </DetailRow>
                ) : null}
                {booking.paidAt ? (
                  <DetailRow label="وقت الدفع">
                    <span className="text-xs">{booking.paidAt.toLocaleString("ar-SA")}</span>
                  </DetailRow>
                ) : null}
                {balanceDueAtBranch > 0 ? (
                  <DetailRow label="مستحق عند الإرجاع">
                    <SarAmountWithSymbol
                      bold
                      amountClassName="font-extrabold text-amber-700"
                      glyphClassName="text-amber-700"
                    >
                      {formatSarAmount(balanceDueAtBranch)}
                    </SarAmountWithSymbol>
                  </DetailRow>
                ) : null}
              </dl>
              {balanceDueAtBranch > 0 ? (
                <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-300/70 bg-amber-50 px-3.5 py-3 text-xs font-bold leading-relaxed text-amber-950">
                  <CreditCard className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                  <span>
                    مدّد العميل مدة الحجز — فرق قدره{" "}
                    <SarAmountWithSymbol
                      amountClassName="font-extrabold"
                      glyphClassName="text-amber-900"
                    >
                      {formatSarAmount(balanceDueAtBranch)}
                    </SarAmountWithSymbol>{" "}
                    {booking.paymentStatus.trim().toUpperCase() === "PAID"
                      ? "يُطالَب به نقداً عند تسليم/إرجاع السيارة في الفرع (تمديد بعد الدفع)."
                      : "يُحصَّل ضمن إجمالي الحجز عند الاستلام/الإرجاع في الفرع."}
                  </span>
                </div>
              ) : null}


            </BookingDetailSection>
          ) : null}

          {booking.kind === "DIRECT" ? (
            <BookingDetailSection
              id="attachments"
              icon={Package}
              title="المرفقات"
              description="صور الهوية / الجواز ورخصة القيادة المرفوعة عند الإتمام"
            >
              <BookingAttachmentsPanel largePreview {...kycAttachments} />
            </BookingDetailSection>
          ) : null}
        </div>

        {/* Sidebar */}
        <aside className="space-y-6 lg:sticky lg:top-6">
          {editActions ? (
            <BookingDetailSection
              icon={Settings}
              title="تعديل الطلب"
              description="تغيير بيانات العميل، التواريخ، الفرع، الحالة، أو السيارة"
            >
              {editActions}
            </BookingDetailSection>
          ) : null}

          {booking.kind === "DIRECT" ? (
            <BookingDetailSection
              icon={Car}
              title="مراحل التشغيل"
              description="استلام المركبة من الفرع ثم إرجاعها — للكاش تُرسل الفاتورة عند الإرجاع"
            >
              <BookingLifecyclePanel
                bookingRequestId={booking.id}
                kind={booking.kind}
                status={booking.status}
                paymentStatus={booking.paymentStatus}
                paymentMethod={booking.paymentMethod}
                vehiclePickedUpAt={
                  (booking as { vehiclePickedUpAt?: Date | null }).vehiclePickedUpAt ?? null
                }
                vehicleReturnedAt={
                  (booking as { vehicleReturnedAt?: Date | null }).vehicleReturnedAt ?? null
                }
              />
            </BookingDetailSection>
          ) : null}

          <BookingDetailSection
            icon={Ban}
            title="إلغاء الحجز"
            description="سياسة العميل: شرائح الخصم والاسترداد"
          >
            <BookingCancelPanel
              bookingRequestId={booking.id}
              kind={booking.kind}
              status={booking.status}
              paymentStatus={booking.paymentStatus}
              paymentMethod={booking.paymentMethod}
              pickupDateIso={booking.pickupDate.toISOString()}
              numberOfDays={booking.numberOfDays}
              cancellationDeductedDays={booking.cancellationDeductedDays}
              cancellationRefundAmountSar={booking.cancellationRefundAmountSar}
              cancellationRefundExternalRef={booking.cancellationRefundExternalRef}
              cancellationPolicyAr={cancellation.cancellationPolicyAr}
              cancelMinHoursBeforePickup={cancellation.cancelMinHoursBeforePickup}
              cancellationDeductTiers={cancellation.cancellationDeductTiers}
              cancellationFinancePreview={cancellation.cancellationFinancePreview}
            />
          </BookingDetailSection>

          <BookingDetailSection icon={Calendar} title="السجل">
            <dl className="space-y-3 text-sm">
              <DetailRow label="أُنشئ">
                <span className="text-xs">{booking.createdAt.toLocaleString("ar-SA")}</span>
              </DetailRow>
              <DetailRow label="آخر تحديث">
                <span className="text-xs">{booking.updatedAt.toLocaleString("ar-SA")}</span>
              </DetailRow>
              {booking.cancelledAt ? (
                <DetailRow label="أُلغي في">
                  <span className="text-xs">{booking.cancelledAt.toLocaleString("ar-SA")}</span>
                </DetailRow>
              ) : null}
              <DetailRow label="رقم الطلب" mono>
                #{booking.id}
              </DetailRow>
            </dl>
          </BookingDetailSection>

          {interBranch && booking.returnBranch?.slug ? (
            <Link
              href={`/admin/branch-returns?branch=${booking.returnBranch.slug}`}
              className="flex items-center justify-center gap-2 rounded-2xl border border-amber-300/60 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-950 transition-colors hover:bg-amber-100/80"
            >
              <ArrowLeftRight className="h-4 w-4" aria-hidden />
              مرتجعات فرع {booking.returnBranch.name}
            </Link>
          ) : null}
        </aside>
      </div>
    </div>
  );
}
