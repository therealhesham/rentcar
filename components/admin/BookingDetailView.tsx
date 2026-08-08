"use client";

import { useState } from "react";
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
  Hash,
  Clock,
  Pencil,
  Key,
  CheckCircle2,
} from "lucide-react";
import type { ReactNode } from "react";
import { AdminKindBadge, AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { SarAmountWithSymbol } from "@/components/ui/SarAmountWithSymbol";
import { computeCheckoutTotals, formatSarAmount } from "@/lib/booking-checkout-pricing";
import { BookingAttachmentsPanel } from "@/components/admin/BookingAttachmentsPanel";
import { BookingCancelPanel } from "@/components/admin/BookingCancelPanel";
import { BookingConfirmPanel } from "@/components/admin/BookingConfirmPanel";
import { BookingLifecyclePanel } from "@/components/admin/BookingLifecyclePanel";
import { BookingDetailSection } from "@/components/admin/BookingDetailSection";
import type { AdminBookingCancellationContext } from "@/lib/admin-booking-cancellation";
import type { AdminBookingDetail } from "@/lib/admin-booking-detail";
import { isInterBranchPickupReturn } from "@/lib/booking-branches";
import { bookingPaymentMethodLabelAr } from "@/lib/booking-payment-method-label";
import { resolveBookingKycForDisplay } from "@/lib/booking-kyc-display";
import { formatReturnDateAr } from "@/lib/booking-return-schedule";
import {
  parseBookingPricingSnapshot,
  resolveBookingRentalPricePerDayExclTax,
} from "@/lib/booking-pricing-snapshot";
import { computeBookingOutstanding } from "@/lib/booking-outstanding";
import { addDaysToYmd } from "@/lib/booking-calendar-ymd";
import { BookingHeaderGearMenu } from "@/components/admin/BookingHeaderGearMenu";
import { VehiclePlateHandoverModal } from "@/components/admin/VehiclePlateHandoverModal";

function paymentStatusLabelAr(ps: string, balanceDue?: number): string {
  const k = ps.trim().toUpperCase();
  if (k === "PAID") return (balanceDue && balanceDue > 0) ? "مدفوع جزئياً" : "مدفوع";
  if (k === "REFUNDED") return "مسترد بالكامل";
  if (k === "PARTIAL_REFUND") return "استرداد جزئي";
  if (k === "NO_REFUND") return "بدون استرداد";
  return "بانتظار الدفع";
}

function paymentStatusStyles(ps: string, balanceDue?: number): string {
  const k = ps.trim().toUpperCase();
  if (k === "PAID") return (balanceDue && balanceDue > 0) ? "bg-amber-50 text-amber-950 ring-amber-200/60" : "bg-emerald-50 text-emerald-900 ring-emerald-200/60";
  if (k === "REFUNDED") return "bg-sky-50 text-sky-900 ring-sky-200/60";
  if (k === "PARTIAL_REFUND") return "bg-violet-50 text-violet-900 ring-violet-200/60";
  if (k === "NO_REFUND") return "bg-neutral-100 text-neutral-800 ring-neutral-200/60";
  return "bg-amber-50 text-amber-950 ring-amber-200/60";
}

function formatFullDateTimeAr(dateVal: Date | string | null | undefined): string {
  if (!dateVal) return "—";
  try {
    const d = new Date(dateVal);
    return d.toLocaleString("ar-SA", {
      weekday: "short",
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
      timeZone: "Asia/Riyadh",
    });
  } catch {
    return String(dateVal);
  }
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
  /** يتحكم بظهور «استرداد كامل» و«بلا استرداد» — يُحسب من صلاحيات جلسة الإدارة على السيرفر. */
  canOverrideCancelPolicy: boolean;
};

export function BookingDetailView({
  booking,
  editActions,
  cancellation,
  canOverrideCancelPolicy,
}: Props) {
  const [updatePlateModalOpen, setUpdatePlateModalOpen] = useState(false);
  const kycAttachments = resolveBookingKycForDisplay(booking, booking.customer);

  const pickupYmd = booking.pickupDate.toISOString().slice(0, 10);
  const returnYmd = addDaysToYmd(pickupYmd, booking.numberOfDays);
  const pickupDateTimeAr = formatFullDateTimeAr(booking.pickupDate);
  const scheduledReturnDateObj = new Date(new Date(booking.pickupDate).getTime() + booking.numberOfDays * 24 * 60 * 60 * 1000);
  const scheduledReturnDateTimeAr = formatFullDateTimeAr(scheduledReturnDateObj);

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

  const { addons, interCityShipping, checkoutOneTimeFees, delayPenalty, couponCode } =
    parseBookingPricingSnapshot(booking.addonsJson);
  const effectiveRentalPrice = booking.carModel
    ? resolveBookingRentalPricePerDayExclTax(booking.carModel.price, booking.addonsJson)
    : 0;
  const oneTimeFeesTotal =
    (interCityShipping?.feeExclVatSar ?? 0) +
    checkoutOneTimeFees.reduce((acc, f) => acc + f.feeExclVatSar, 0);
  const couponDiscountExclTax = couponCode?.scope === "FULL_TOTAL" ? couponCode.discountExclTax : 0;

  const amountTotals = computeCheckoutTotals(
    effectiveRentalPrice,
    booking.numberOfDays,
    booking.carModel?.vatRatePercent ?? 15,
    addons.map((a) => ({ pricePerDay: a.pricePerDayExclTax })),
    { oneTimeFeesExclTax: oneTimeFeesTotal, discountExclTax: couponDiscountExclTax },
  );

  // رصيد التحصيل من المصدر الموحّد — يُمرَّر للوحة الإرجاع كتنبيه للموظف.
  const { outstandingDueSar } = computeBookingOutstanding(booking);



  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Top Header */}
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
          <BookingHeaderGearMenu
            bookingId={booking.id}
            kind={booking.kind}
            currentPlateNumber={booking.vehiclePlateNumber}
            onOpenPlateModal={() => setUpdatePlateModalOpen(true)}
          />
        }
      />

      {/* Hero summary */}
      <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-3.5">
            <div className="flex flex-wrap items-center gap-2">
              <AdminKindBadge kind={booking.kind} />
              <AdminStatusBadge status={booking.status} />
              {booking.kind === "DIRECT" ? (
                <span
                  className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${paymentStatusStyles(booking.paymentStatus, balanceDueAtBranch)}`}
                >
                  {paymentStatusLabelAr(booking.paymentStatus, balanceDueAtBranch)}
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

            {/* Plate Number & Quick History Badge */}
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              <span className="inline-flex items-center gap-2 rounded-xl border border-[#003749]/20 bg-[#fffdf8] px-3.5 py-1.5 text-xs font-extrabold text-[#003749] shadow-2xs">
                <Hash className="size-3.5 text-[#dbb878]" />
                <span>رقم اللوحة: {booking.vehiclePlateNumber || "غير محددة"}</span>
                <button
                  type="button"
                  onClick={() => setUpdatePlateModalOpen(true)}
                  className="ms-1 rounded-md bg-[#003749]/10 px-2 py-0.5 text-[11px] font-extrabold text-[#003749] hover:bg-[#003749] hover:text-white transition-colors"
                >
                  {booking.vehiclePlateNumber ? "تعديل ⚙️" : "ربط لوحة ➕"}
                </button>
              </span>

              {booking.vehiclePlateNumber ? (
                <Link
                  href={`/admin/car-bookings?plate=${encodeURIComponent(booking.vehiclePlateNumber)}`}
                  className="inline-flex items-center gap-1 text-xs font-extrabold text-primary hover:underline"
                >
                  استعلام الحجوزات السابقة باللوحة →
                </Link>
              ) : null}
            </div>

            {/* Date & Time display */}
            <div className="space-y-2 pt-2 text-xs font-bold text-on-surface">
              <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-container-low/60 p-3 border border-outline-variant/20">
                <div className="flex items-center gap-2 text-sky-900">
                  <Clock className="size-4 shrink-0 text-sky-700" />
                  <span>الاستلام (الاستلام المحدد):</span>
                  <span className="font-extrabold text-[#003749]">{pickupDateTimeAr}</span>
                </div>
                <span className="hidden sm:inline text-outline">•</span>
                <div className="flex items-center gap-2 text-violet-900">
                  <Clock className="size-4 shrink-0 text-violet-700" />
                  <span>الإرجاع (الإرجاع المجدول):</span>
                  <span className="font-extrabold text-[#003749]">{scheduledReturnDateTimeAr}</span>
                </div>
                <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-black text-primary ms-auto">
                  المدة: {booking.numberOfDays} {booking.numberOfDays === 1 ? "يوم" : "أيام"}
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
                    className="inline-flex items-center gap-1.5 text-primary hover:underline"
                  >
                    <Mail className="h-3.5 w-3.5" aria-hidden />
                    {booking.contactEmail}
                  </a>
                </DetailRow>
              ) : null}
              <DetailRow label="الفئة العمرية">{booking.ageRange}</DetailRow>
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

          {booking.kind === "DIRECT" ? (
            <BookingDetailSection icon={CreditCard} title="الدفع">
              <dl className="space-y-3.5">
                <DetailRow label="الحالة">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-bold ring-1 ring-inset ${paymentStatusStyles(booking.paymentStatus, balanceDueAtBranch)}`}
                  >
                    {paymentStatusLabelAr(booking.paymentStatus, balanceDueAtBranch)}
                  </span>
                </DetailRow>
                {typeof booking.snapshotTotalAmountSar === "number" &&
                booking.snapshotTotalAmountSar > 0 ? (
                  <DetailRow label="إجمالي الحجز (شامل الضريبة)" mono>
                    <SarAmountWithSymbol
                      bold
                      amountClassName="font-extrabold text-on-surface"
                      glyphClassName="text-on-surface-variant"
                    >
                      {formatSarAmount(booking.snapshotTotalAmountSar)}
                    </SarAmountWithSymbol>
                  </DetailRow>
                ) : null}
                <DetailRow label="طريقة الدفع">
                  {bookingPaymentMethodLabelAr(booking.paymentMethod)}
                </DetailRow>
                {booking.paidAt ? (
                  <DetailRow label="تاريخ الدفع" mono>
                    {formatFullDateTimeAr(booking.paidAt)}
                  </DetailRow>
                ) : null}
              </dl>

              {balanceDueAtBranch > 0 ? (
                <div className="mt-4 rounded-xl border border-amber-200/80 bg-amber-50/90 p-4 text-amber-950">
                  <p className="text-xs font-bold">مستحق التحصيل في الفرع (عند الاستلام أو الإرجاع):</p>
                  <p className="mt-1 font-mono text-lg font-black text-amber-900" dir="ltr">
                    {formatSarAmount(balanceDueAtBranch)} ر.س
                  </p>
                </div>
              ) : null}
            </BookingDetailSection>
          ) : null}

          {booking.kind === "DIRECT" ? (
            <BookingDetailSection
              icon={Receipt}
              title="تفاصيل المبلغ"
              description="لقطة تفصيل السعر عند إنشاء الحجز"
            >
              <dl className="space-y-3">
                <DetailRow
                  label={`أجرة المركبة (${formatSarAmount(effectiveRentalPrice)} × ${booking.numberOfDays} ${booking.numberOfDays === 1 ? "يوم" : "أيام"})`}
                  mono
                >
                  <SarAmountWithSymbol>{formatSarAmount(amountTotals.rentalExclTax)}</SarAmountWithSymbol>
                </DetailRow>
                {addons.map((a, i) => (
                  <DetailRow key={`addon-${i}`} label={a.titleAr} mono>
                    <SarAmountWithSymbol>{formatSarAmount(a.lineTotalExclTax)}</SarAmountWithSymbol>
                  </DetailRow>
                ))}
                {interCityShipping ? (
                  <DetailRow label={interCityShipping.labelAr} mono>
                    <SarAmountWithSymbol>{formatSarAmount(interCityShipping.feeExclVatSar)}</SarAmountWithSymbol>
                  </DetailRow>
                ) : null}
                {checkoutOneTimeFees.map((f, i) => (
                  <DetailRow key={`fee-${i}`} label={f.labelAr} mono>
                    <SarAmountWithSymbol>{formatSarAmount(f.feeExclVatSar)}</SarAmountWithSymbol>
                  </DetailRow>
                ))}
                <DetailRow label={`ضريبة القيمة المضافة (${booking.carModel?.vatRatePercent ?? 15}٪)`} mono>
                  <SarAmountWithSymbol>{formatSarAmount(amountTotals.vatAmount)}</SarAmountWithSymbol>
                </DetailRow>
                <div className="pt-2 border-t border-outline-variant/20">
                  <DetailRow label="الإجمالي النهائي" mono>
                    <SarAmountWithSymbol bold amountClassName="text-base text-primary">
                      {formatSarAmount(amountTotals.totalInclTax)}
                    </SarAmountWithSymbol>
                  </DetailRow>
                </div>
              </dl>
            </BookingDetailSection>
          ) : null}
        </div>

        {/* Sidebar column */}
        <div className="space-y-6">
          {statusKeyUpper === "NEW" || statusKeyUpper === "UNDER_REVIEW" ? (
            <BookingDetailSection
              icon={CheckCircle2}
              title="تأكيد الطلب"
              description="تأكيد الحجز أو رفضه دون مغادرة صفحة الطلب"
            >
              <BookingConfirmPanel
                bookingRequestId={booking.id}
                kind={booking.kind}
                status={booking.status}
                carModelId={booking.carModelId}
              />
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
                carModelId={booking.carModelId}
                currentPlateNumber={booking.vehiclePlateNumber}
                outstandingDueSar={outstandingDueSar}
                odometerAtPickupKm={booking.odometerAtPickupKm}
                odometerAtReturnKm={booking.odometerAtReturnKm}
                numberOfDays={booking.numberOfDays}
              />
            </BookingDetailSection>
          ) : null}

          <BookingDetailSection
            icon={Ban}
            title="إلغاء الحجز والسياسات"
            description="إدارة الاسترداد وقواعد الخصم للعميل"
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
              paidAmountSar={booking.paidAmountSar}
              canOverrideCancelPolicy={canOverrideCancelPolicy}
              {...cancellation}
            />
          </BookingDetailSection>
        </div>
      </div>

      {/* Plate Edit Modal */}
      <VehiclePlateHandoverModal
        isOpen={updatePlateModalOpen}
        onClose={() => setUpdatePlateModalOpen(false)}
        bookingId={booking.id}
        carModelId={booking.carModelId}
        mode="UPDATE_ONLY"
        currentPlateNumber={booking.vehiclePlateNumber}
      />
    </div>
  );
}
