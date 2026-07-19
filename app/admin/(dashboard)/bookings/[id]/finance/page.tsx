import { notFound } from "next/navigation";
import { assertBookingRequestInScope } from "@/lib/admin-access";
import { requireAdminPagePermission } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { BookingFinanceOperationsPanel } from "@/components/admin/BookingFinanceOperationsPanel";
import { BookingPaymentPanel } from "@/components/admin/BookingPaymentPanel";
import { SarAmountWithSymbol } from "@/components/ui/SarAmountWithSymbol";
import { computeCheckoutTotals, formatSarAmount } from "@/lib/booking-checkout-pricing";
import { bookingPaymentMethodLabelAr } from "@/lib/booking-payment-method-label";
import {
  parseBookingPricingSnapshot,
  resolveBookingRentalPricePerDayExclTax,
} from "@/lib/booking-pricing-snapshot";

export const dynamic = "force-dynamic";

function paymentStatusLabelAr(ps: string): string {
  const k = ps.trim().toUpperCase();
  if (k === "PAID")           return "مدفوع";
  if (k === "REFUNDED")       return "مسترد بالكامل";
  if (k === "PARTIAL_REFUND") return "استرداد جزئي";
  if (k === "NO_REFUND")      return "بدون استرداد";
  return "بانتظار الدفع";
}

function paymentStatusStyles(ps: string): string {
  const k = ps.trim().toUpperCase();
  if (k === "PAID")           return "bg-emerald-50 text-emerald-800 ring-emerald-200/60";
  if (k === "REFUNDED")       return "bg-sky-50 text-sky-800 ring-sky-200/60";
  if (k === "PARTIAL_REFUND") return "bg-violet-50 text-violet-800 ring-violet-200/60";
  if (k === "NO_REFUND")      return "bg-neutral-100 text-neutral-700 ring-neutral-200/60";
  return "bg-amber-50 text-amber-900 ring-amber-200/60";
}

export default async function BookingFinancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdminPagePermission("FINANCIALS");
  const { id: idRaw } = await params;
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id < 1) notFound();

  const scope = await assertBookingRequestInScope(session, id);
  if (!scope.ok) notFound();

  const booking = await prisma.bookingRequest.findUnique({
    where: { id },
    select: {
      id: true,
      fullName: true,
      status: true,
      kind: true,
      paymentStatus: true,
      paymentMethod: true,
      paidAmountSar: true,
      paidAt: true,
      paymentReceivedBy: true,
      paymentExternalRef: true,
      cancellationRefundAmountSar: true,
      balanceDueAtBranchSar: true,
      numberOfDays: true,
      addonsJson: true,
      carModel: { select: { price: true, vatRatePercent: true } },
    },
  });

  if (!booking) notFound();

  const statusKey = booking.paymentStatus.trim().toUpperCase();
  const canPay    = statusKey !== "PAID" && statusKey !== "REFUNDED";

  const { addons, interCityShipping, checkoutOneTimeFees, delayPenalty } =
    parseBookingPricingSnapshot(booking.addonsJson);
  const effectiveRentalPrice = booking.carModel
    ? resolveBookingRentalPricePerDayExclTax(booking.carModel.price, booking.addonsJson)
    : 0;
  const oneTimeFeesExclTax =
    (interCityShipping?.feeExclVatSar ?? 0) +
    checkoutOneTimeFees.reduce((s, x) => s + x.feeExclVatSar, 0) +
    (delayPenalty?.feeExclVatSar ?? 0);
  const vatRate = booking.carModel?.vatRatePercent ?? 15;
  const totals = computeCheckoutTotals(
    effectiveRentalPrice,
    booking.numberOfDays,
    vatRate,
    addons.map((a) => ({ pricePerDay: a.pricePerDayExclTax })),
    { oneTimeFeesExclTax },
  );
  const totalAmountSar = totals.totalInclTax;
  const remainingDueSar = Math.max(0, totalAmountSar - (booking.paidAmountSar ?? 0));

  // الرصيد لا يُحصَّل في الحالات النهائية (ملغى/مرفوض/مسترد) — وإلا يُعرض متبقياً
  // بصرف النظر عن حالة الدفع (حجز مدفوع جزئياً بعد تمديد له رصيد قائم).
  const bookingStatusKey = booking.status.trim().toUpperCase();
  const bookingTerminal =
    bookingStatusKey === "CANCELLED" || bookingStatusKey === "REJECTED";
  const refundedState = statusKey === "REFUNDED" || statusKey === "PARTIAL_REFUND";
  const outstandingDueSar =
    bookingTerminal || refundedState ? 0 : Math.round(remainingDueSar * 100) / 100;
  const isPartiallyPaid = statusKey === "PAID" && outstandingDueSar > 0;

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <AdminPageHeader
        backHref={`/admin/bookings/${id}`}
        backLabel={`حجز #${id}`}
        title="العمليات المالية"
        description={`إدارة الأمور المالية المتعلقة بحجز ${booking.fullName}`}
      />

      <div className="grid gap-6 md:grid-cols-[1fr_300px] items-start">
        {/* العمود الرئيسي */}
        <div className="space-y-6">
          {/* تسجيل دفعة — يظهر فقط إذا لم يكن مدفوعاً */}
          {booking.kind === "DIRECT" ? (
            <BookingPaymentPanel
              bookingId={id}
              paymentStatus={booking.paymentStatus}
              fullAmountSar={outstandingDueSar}
            />
          ) : null}

          {/* استرداد */}
          <BookingFinanceOperationsPanel
            bookingId={id}
            paymentStatus={booking.paymentStatus}
            currentRefundAmount={booking.cancellationRefundAmountSar || 0}
            totalPaidAmountSar={booking.paidAmountSar ?? null}
          />
        </div>

        {/* الشريط الجانبي */}
        <aside className="space-y-4">
          {/* المبلغ الكلي */}
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[#003749] to-[#00506b] p-5 shadow-sm">
            <div
              className="pointer-events-none absolute -left-8 -top-8 h-28 w-28 rounded-full bg-white/5"
              aria-hidden
            />
            <p className="text-xs font-bold text-white/70">المبلغ الكلي للحجز</p>
            <div className="mt-1.5">
              <SarAmountWithSymbol
                amountClassName="text-3xl font-black text-white"
                glyphClassName="text-white/70"
              >
                {formatSarAmount(totalAmountSar)}
              </SarAmountWithSymbol>
            </div>
            {outstandingDueSar > 0 ? (
              <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-amber-200">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-300" />
                متبقٍ للتحصيل:{" "}
                <SarAmountWithSymbol
                  amountClassName="font-bold text-amber-200"
                  glyphClassName="text-amber-200/70"
                >
                  {formatSarAmount(outstandingDueSar)}
                </SarAmountWithSymbol>
              </p>
            ) : (
              <p className="mt-3 text-xs font-semibold text-emerald-200">
                لا يوجد مبلغ متبقٍ للتحصيل
              </p>
            )}
          </div>

          {/* ملخص الدفع */}
          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-bold text-on-surface">ملخص الدفع</h3>
            <dl className="space-y-3 text-sm">
              {/* حالة الدفع */}
              <div className="flex items-center justify-between gap-2">
                <dt className="font-medium text-on-surface-variant">الحالة</dt>
                <dd>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${
                      isPartiallyPaid
                        ? "bg-amber-50 text-amber-900 ring-amber-200/60"
                        : paymentStatusStyles(booking.paymentStatus)
                    }`}
                  >
                    {isPartiallyPaid ? "مدفوع جزئياً" : paymentStatusLabelAr(booking.paymentStatus)}
                  </span>
                </dd>
              </div>

              {/* طريقة الدفع */}
              <div className="flex items-center justify-between gap-2">
                <dt className="font-medium text-on-surface-variant">الطريقة</dt>
                <dd className="font-bold text-on-surface">
                  {bookingPaymentMethodLabelAr(booking.paymentMethod)}
                </dd>
              </div>

              {/* إجمالي المدفوع */}
              {typeof booking.paidAmountSar === "number" ? (
                <div className="flex items-center justify-between gap-2">
                  <dt className="font-medium text-on-surface-variant">إجمالي المدفوع</dt>
                  <dd className="font-extrabold text-emerald-700">
                    <SarAmountWithSymbol>
                      {formatSarAmount(booking.paidAmountSar)}
                    </SarAmountWithSymbol>
                  </dd>
                </div>
              ) : null}

              {/* مرجع عملية الدفع */}
              {booking.paymentExternalRef ? (
                <div className="flex items-center justify-between gap-2">
                  <dt className="font-medium text-on-surface-variant">مرجع الدفع</dt>
                  <dd className="font-bold text-on-surface" dir="ltr">
                    {booking.paymentExternalRef}
                  </dd>
                </div>
              ) : null}

              {/* إجمالي المسترد */}
              {(booking.cancellationRefundAmountSar ?? 0) > 0 ? (
                <div className="flex items-center justify-between gap-2">
                  <dt className="font-medium text-on-surface-variant">إجمالي المسترد</dt>
                  <dd className="font-extrabold text-sky-700">
                    <SarAmountWithSymbol>
                      {formatSarAmount(booking.cancellationRefundAmountSar ?? 0)}
                    </SarAmountWithSymbol>
                  </dd>
                </div>
              ) : null}

              {/* مستحق عند الفرع */}
              {booking.balanceDueAtBranchSar ? (
                <div className="flex items-center justify-between gap-2">
                  <dt className="font-medium text-on-surface-variant">مستحق عند الفرع</dt>
                  <dd className="font-extrabold text-amber-700">
                    <SarAmountWithSymbol>
                      {formatSarAmount(booking.balanceDueAtBranchSar)}
                    </SarAmountWithSymbol>
                  </dd>
                </div>
              ) : null}

              {/* وقت الدفع */}
              {booking.paidAt ? (
                <div className="flex items-center justify-between gap-2">
                  <dt className="font-medium text-on-surface-variant">وقت الدفع</dt>
                  <dd className="text-xs font-semibold text-on-surface">
                    {booking.paidAt.toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })}
                  </dd>
                </div>
              ) : null}

              {/* استُلم بواسطة */}
              {booking.paymentReceivedBy ? (
                <div className="flex items-center justify-between gap-2">
                  <dt className="font-medium text-on-surface-variant">استُلم بواسطة</dt>
                  <dd className="text-xs font-semibold text-on-surface">
                    {booking.paymentReceivedBy}
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>

          {/* تلميح */}
          {canPay && (
            <div className="rounded-xl border border-amber-200/70 bg-amber-50 px-4 py-3 text-xs font-medium leading-relaxed text-amber-900">
              <p className="font-bold">ملاحظة:</p>
              <p className="mt-1">
                تسجيل الدفعة يُحدّث حالة الحجز إلى «مدفوع» ويحفظ المبلغ والطريقة المختارة.
              </p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
