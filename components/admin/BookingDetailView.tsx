import Link from "next/link";
import { AdminKindBadge, AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { BookingAddonsSnapshot } from "@/components/admin/BookingAddonsSnapshot";
import { BookingAttachmentsPanel } from "@/components/admin/BookingAttachmentsPanel";
import type { AdminBookingDetail } from "@/lib/admin-booking-detail";
import { bookingPaymentMethodLabelAr } from "@/lib/booking-payment-method-label";
import { addDaysToYmd } from "@/lib/direct-booking";

function paymentStatusLabelAr(ps: string): string {
  const k = ps.trim().toUpperCase();
  if (k === "PAID") return "مدفوع";
  if (k === "REFUNDED") return "مسترد بالكامل";
  if (k === "PARTIAL_REFUND") return "استرداد جزئي";
  if (k === "NO_REFUND") return "بدون استرداد";
  return "بانتظار الدفع";
}

type Props = {
  booking: AdminBookingDetail;
};

export function BookingDetailView({ booking }: Props) {
  const pickupYmd = booking.pickupDate.toISOString().slice(0, 10);
  const returnYmd = addDaysToYmd(pickupYmd, booking.numberOfDays);
  const carLabel = booking.carModel
    ? `${booking.carModel.brand.name} ${booking.carModel.name}`
    : booking.carType;

  return (
    <div className="space-y-8">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold text-on-surface-variant">
            <Link href="/admin" className="text-primary hover:underline">
              لوحة التحكم
            </Link>
            <span className="mx-2">·</span>
            <Link href="/admin/car-bookings" className="text-primary hover:underline">
              حجوزات السيارات
            </Link>
          </p>
          <h1 className="mt-2 text-3xl font-extrabold tracking-tight">
            حجز #{booking.id}
          </h1>
          <p className="mt-1 text-on-surface-variant">{booking.fullName}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <AdminKindBadge kind={booking.kind} />
            <AdminStatusBadge status={booking.status} />
            {booking.kind === "DIRECT" ? (
              <span className="rounded-full bg-surface-container-high px-3 py-1 text-xs font-bold text-on-surface">
                {paymentStatusLabelAr(booking.paymentStatus)}
              </span>
            ) : null}
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {booking.kind === "DIRECT" ? (
            <Link
              href={`/fleet/payment/${booking.id}`}
              target="_blank"
              className="rounded-xl border border-primary/30 bg-primary-container/30 px-4 py-2 text-sm font-bold text-primary hover:bg-primary-container/50"
            >
              صفحة الدفع
            </Link>
          ) : null}
          <Link
            href="/admin"
            className="rounded-xl bg-primary px-4 py-2 text-sm font-bold text-on-primary hover:opacity-95"
          >
            تعديل من اللوحة
          </Link>
        </div>
      </header>

      <section className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5 md:p-6">
          <h2 className="text-lg font-extrabold text-primary">بيانات العميل</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-xs font-bold text-on-surface-variant">الاسم</dt>
              <dd className="font-medium">{booking.fullName}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-on-surface-variant">الجوال</dt>
              <dd className="font-mono tabular-nums" dir="ltr">
                {booking.phone}
              </dd>
            </div>
            {booking.contactEmail ? (
              <div>
                <dt className="text-xs font-bold text-on-surface-variant">البريد</dt>
                <dd className="font-mono text-xs" dir="ltr">
                  {booking.contactEmail}
                </dd>
              </div>
            ) : null}
            <div>
              <dt className="text-xs font-bold text-on-surface-variant">الفئة العمرية</dt>
              <dd>{booking.ageRange}</dd>
            </div>
            {booking.customer ? (
              <div>
                <dt className="text-xs font-bold text-on-surface-variant">حساب مسجّل</dt>
                <dd>
                  {booking.customer.name ?? "—"} — {booking.customer.email}
                </dd>
              </div>
            ) : null}
          </dl>
        </div>

        <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5 md:p-6">
          <h2 className="text-lg font-extrabold text-primary">الرحلة والفروع</h2>
          <dl className="mt-4 space-y-3 text-sm">
            <div>
              <dt className="text-xs font-bold text-on-surface-variant">السيارة</dt>
              <dd className="font-medium">{carLabel}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-on-surface-variant">فرع الاستلام</dt>
              <dd>{booking.pickupBranch?.name ?? (booking.pickupMode === "DELIVERY" ? "توصيل" : "—")}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-on-surface-variant">فرع الإرجاع</dt>
              <dd>{booking.returnBranch?.name ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-on-surface-variant">من — إلى</dt>
              <dd className="font-mono tabular-nums" dir="ltr">
                {pickupYmd} → {returnYmd} ({booking.numberOfDays} يوم)
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-on-surface-variant">طريقة الاستلام</dt>
              <dd>{booking.pickupMode === "DELIVERY" ? "توصيل" : "من الفرع"}</dd>
            </div>
            {booking.pickupMode === "DELIVERY" && booking.deliveryAddress?.trim() ? (
              <div>
                <dt className="text-xs font-bold text-on-surface-variant">عنوان التوصيل</dt>
                <dd className="whitespace-pre-wrap">{booking.deliveryAddress.trim()}</dd>
              </div>
            ) : null}
          </dl>
        </div>
      </section>

      {booking.kind === "DIRECT" ? (
        <>
          <section className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5 md:p-6">
            <h2 className="text-lg font-extrabold text-primary">المرفقات</h2>
            <p className="mt-1 text-sm text-on-surface-variant">
              صور الهوية / الجواز ورخصة القيادة المرفوعة عند إتمام الحجز.
            </p>
            <div className="mt-4">
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
            </div>
          </section>

          {booking.addonsJson ? (
            <section className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5 md:p-6">
              <h2 className="text-lg font-extrabold text-primary">الإضافات والرسوم</h2>
              <div className="mt-4">
                <BookingAddonsSnapshot raw={booking.addonsJson} />
              </div>
            </section>
          ) : null}

          <section className="rounded-2xl border border-outline-variant/30 bg-surface-container-low p-5 md:p-6">
            <h2 className="text-lg font-extrabold text-primary">الدفع</h2>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-xs font-bold text-on-surface-variant">حالة الدفع</dt>
                <dd className="font-medium">{paymentStatusLabelAr(booking.paymentStatus)}</dd>
              </div>
              {booking.paymentMethod ? (
                <div>
                  <dt className="text-xs font-bold text-on-surface-variant">الطريقة</dt>
                  <dd>{bookingPaymentMethodLabelAr(booking.paymentMethod)}</dd>
                </div>
              ) : null}
              {booking.paidAt ? (
                <div>
                  <dt className="text-xs font-bold text-on-surface-variant">وقت الدفع</dt>
                  <dd dir="ltr">{booking.paidAt.toLocaleString("ar-SA")}</dd>
                </div>
              ) : null}
            </dl>
          </section>
        </>
      ) : null}

      <section className="rounded-2xl border border-outline-variant/20 bg-surface-container-low/60 px-5 py-4 text-xs text-on-surface-variant">
        <p>
          أُنشئ {booking.createdAt.toLocaleString("ar-SA")} — آخر تحديث{" "}
          {booking.updatedAt.toLocaleString("ar-SA")}
        </p>
      </section>
    </div>
  );
}
