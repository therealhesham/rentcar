import Link from "next/link";
import {
  ArrowLeftRight,
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
import { BookingAddonsSnapshot } from "@/components/admin/BookingAddonsSnapshot";
import { BookingAttachmentsPanel } from "@/components/admin/BookingAttachmentsPanel";
import { BookingDetailSection } from "@/components/admin/BookingDetailSection";
import type { AdminBookingDetail } from "@/lib/admin-booking-detail";
import { isInterBranchPickupReturn } from "@/lib/booking-branches";
import { bookingPaymentMethodLabelAr } from "@/lib/booking-payment-method-label";
import { formatReturnDateAr } from "@/lib/booking-return-schedule";
import { addDaysToYmd } from "@/lib/direct-booking";

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

function SummaryStat({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-white/60 bg-white/70 px-4 py-3 backdrop-blur-sm">
      <p className="text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
        {label}
      </p>
      <p className="mt-1 text-sm font-extrabold leading-snug text-on-surface">{value}</p>
      {sub ? <p className="mt-0.5 text-xs text-on-surface-variant">{sub}</p> : null}
    </div>
  );
}

function BranchPill({ label, name }: { label: string; name: string }) {
  return (
    <div className="min-w-0 flex-1 rounded-xl border border-outline-variant/20 bg-white px-4 py-3 shadow-sm">
      <p className="text-[10px] font-bold uppercase tracking-wide text-on-surface-variant">
        {label}
      </p>
      <p className="mt-1 truncate text-sm font-extrabold text-[#003749]">{name}</p>
    </div>
  );
}

type Props = {
  booking: AdminBookingDetail;
  editActions?: ReactNode;
};

export function BookingDetailView({ booking, editActions }: Props) {
  const pickupYmd = booking.pickupDate.toISOString().slice(0, 10);
  const returnYmd = addDaysToYmd(pickupYmd, booking.numberOfDays);
  const carLabel = booking.carModel
    ? `${booking.carModel.brand.name} ${booking.carModel.name}`
    : booking.carType;
  const carImage = booking.carModel?.image?.trim() || null;
  const pickupName =
    booking.pickupBranch?.name ?? (booking.pickupMode === "DELIVERY" ? "توصيل للعميل" : "—");
  const returnName = booking.returnBranch?.name ?? "—";
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
          href={`/fleet/payment/${booking.id}`}
          target="_blank"
          className="inline-flex items-center gap-2 rounded-xl border border-outline-variant/30 bg-white px-4 py-2.5 text-sm font-bold text-on-surface shadow-sm transition-colors hover:bg-surface-container-low"
        >
          <ExternalLink className="h-4 w-4" aria-hidden />
          صفحة الدفع
        </Link>
      ) : null}
      <Link
        href={`/admin/bookings/${booking.id}?edit=1`}
        className="inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary shadow-sm transition-opacity hover:opacity-95"
      >
        تعديل الطلب
      </Link>
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
        // actions={headerActions}
      />

      {/* Hero summary */}
      <div className="mb-8 overflow-hidden rounded-2xl border border-outline-variant/25 bg-gradient-to-bl from-primary-container/35 via-white to-surface-container-low shadow-[0_8px_32px_-12px_rgba(0,55,73,0.15)]">
        <div className="p-5 sm:p-6 lg:p-7">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-start lg:justify-between">
            <div className="flex min-w-0 flex-1 gap-4">
              {carImage ? (
                <div className="hidden shrink-0 overflow-hidden rounded-2xl border border-outline-variant/20 bg-white shadow-sm sm:block sm:h-24 sm:w-36">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={carImage}
                    alt={carLabel}
                    className="h-full w-full object-cover"
                  />
                </div>
              ) : (
                <div className="hidden h-24 w-36 shrink-0 items-center justify-center rounded-2xl border border-outline-variant/20 bg-white text-primary sm:flex">
                  <Car className="h-10 w-10 opacity-40" aria-hidden />
                </div>
              )}
              <div className="min-w-0 flex-1">
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
                <p className="mt-3 text-xl font-extrabold tracking-tight text-[#003749] sm:text-2xl">
                  {carLabel}
                </p>
                {booking.carModel?.year ? (
                  <p className="mt-1 text-sm text-on-surface-variant">
                    {booking.carModel.category.title} · {booking.carModel.year}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="grid w-full gap-2 sm:grid-cols-2 lg:max-w-md lg:grid-cols-2">
              <SummaryStat
                label="مدة الحجز"
                value={`${booking.numberOfDays} ${booking.numberOfDays === 1 ? "يوم" : "أيام"}`}
              />
              <SummaryStat
                label="بداية الاستلام"
                value={formatReturnDateAr(pickupYmd)}
                sub={formatPickupDateTime(booking.pickupDate)}
              />
              <SummaryStat label="موعد الإرجاع" value={formatReturnDateAr(returnYmd)} />
              <SummaryStat
                label="طريقة الاستلام"
                value={booking.pickupMode === "DELIVERY" ? "توصيل" : "من الفرع"}
              />
            </div>
          </div>

          {booking.kind === "DIRECT" ? (
            <div className="mt-6">
              {interBranch ? (
                <p className="mb-3 flex items-center gap-2 rounded-xl border border-amber-200/80 bg-amber-50/90 px-3 py-2 text-xs font-bold text-amber-950">
                  <ArrowLeftRight className="h-4 w-4 shrink-0" aria-hidden />
                  استلام من فرع وإرجاع لفرع آخر — راجع المرتجعات لتأكيد تحويل المخزون
                </p>
              ) : null}
              <div className="flex flex-col items-stretch gap-2 sm:flex-row sm:items-center">
                <BranchPill label="فرع الاستلام" name={pickupName} />
                <span
                  className="flex h-9 w-9 shrink-0 items-center justify-center self-center rounded-full bg-primary/10 text-primary"
                  aria-hidden
                >
                  <ArrowLeftRight className="h-4 w-4" />
                </span>
                <BranchPill label="فرع الإرجاع" name={returnName} />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(17rem,22rem)] lg:items-start">
        {/* Main column */}
        <div className="space-y-6">
          {booking.kind === "DIRECT" ? (
            <BookingDetailSection
              id="attachments"
              icon={Package}
              title="المرفقات"
              description="صور الهوية / الجواز ورخصة القيادة المرفوعة عند الإتمام"
            >
              <BookingAttachmentsPanel
                largePreview
                idDocumentKind={booking.idDocumentKind}
                nationalIdNumber={booking.nationalIdNumber}
                passportNumber={booking.passportNumber}
                licenseNumber={booking.licenseNumber}
                licenseExpiryDate={
                  booking.licenseExpiryDate
                    ? booking.licenseExpiryDate.toISOString().slice(0, 10)
                    : null
                }
                idCardImageUrl={booking.idCardImageUrl}
                driverLicenseImageUrl={booking.driverLicenseImageUrl}
              />
            </BookingDetailSection>
          ) : null}

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
              </dl>
            </BookingDetailSection>
          ) : null}

          <BookingDetailSection icon={Calendar} title="السجل">
            <dl className="space-y-3 text-sm">
              <DetailRow label="أُنشئ">
                <span className="text-xs">{booking.createdAt.toLocaleString("ar-SA")}</span>
              </DetailRow>
              <DetailRow label="آخر تحديث">
                <span className="text-xs">{booking.updatedAt.toLocaleString("ar-SA")}</span>
              </DetailRow>
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
