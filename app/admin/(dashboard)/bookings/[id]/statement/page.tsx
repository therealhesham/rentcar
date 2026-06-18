import Link from "next/link";
import { notFound } from "next/navigation";
import { assertBookingRequestInScope } from "@/lib/admin-access";
import { loadAdminBookingDetail } from "@/lib/admin-booking-detail";
import { requireAdminPage } from "@/lib/admin-page";
import { parseBookingPricingSnapshot, resolveBookingRentalPricePerDayExclTax } from "@/lib/booking-pricing-snapshot";
import { computeCheckoutTotals, formatSarAmount } from "@/lib/booking-checkout-pricing";
import { ArrowLeft, Building2, ReceiptText, CalendarClock, Banknote } from "lucide-react";
import { bookingPaymentMethodLabelAr } from "@/lib/booking-payment-method-label";
import { StatementActionsDropdown } from "./StatementActionsDropdown";
import { SarAmountWithSymbol } from "@/components/ui/SarAmountWithSymbol";

export const dynamic = "force-dynamic";

function paymentStatusLabelAr(ps: string): string {
  const k = ps.trim().toUpperCase();
  if (k === "PAID") return "مدفوع";
  if (k === "REFUNDED") return "مسترد بالكامل";
  if (k === "PARTIAL_REFUND") return "استرداد جزئي";
  if (k === "NO_REFUND") return "بدون استرداد";
  return "بانتظار الدفع";
}

export default async function BookingStatementPage(props: {
  params: Promise<{ id: string }>;
}) {
  const session = await requireAdminPage();
  const { id: idRaw } = await props.params;
  const id = Number(idRaw);
  if (!Number.isInteger(id) || id < 1) notFound();

  const scope = await assertBookingRequestInScope(session, id);
  if (!scope.ok) {
    return (
      <div className="mx-auto max-w-lg rounded-2xl border border-outline-variant/30 bg-white px-6 py-10 text-center shadow-sm">
        <p className="font-bold text-on-surface">{scope.error}</p>
        <Link
          href="/admin/car-bookings"
          className="mt-5 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:opacity-95"
        >
          العودة لحجوزات السيارات
        </Link>
      </div>
    );
  }

  const booking = await loadAdminBookingDetail(id);
  if (!booking) notFound();

  const carLabel = booking.carModel
    ? `${booking.carModel.brand.name} ${booking.carModel.name}`
    : booking.carType;

  const { addons, interCityShipping, checkoutOneTimeFees, delayPenalty } =
    parseBookingPricingSnapshot(booking.addonsJson);

  const effectiveRentalPrice = booking.carModel
    ? resolveBookingRentalPricePerDayExclTax(booking.carModel.price, booking.addonsJson)
    : 0;

  const shipFee = interCityShipping?.feeExclVatSar ?? 0;
  const checkoutFeesSum = checkoutOneTimeFees.reduce((s, x) => s + x.feeExclVatSar, 0);
  const delayFee = delayPenalty?.feeExclVatSar ?? 0;

  const vatRate = booking.carModel?.vatRatePercent ?? 15;

  const totals = computeCheckoutTotals(
    effectiveRentalPrice,
    booking.numberOfDays,
    vatRate,
    addons.map((a) => ({ pricePerDay: a.pricePerDayExclTax })),
    { oneTimeFeesExclTax: shipFee + checkoutFeesSum + delayFee },
  );

  const isTerminalStatus = booking.status.trim().toUpperCase() === "CANCELLED" || booking.status.trim().toUpperCase() === "REJECTED";
  const balanceDueAtBranch = !isTerminalStatus && typeof booking.balanceDueAtBranchSar === "number" ? booking.balanceDueAtBranchSar : 0;
  const refundAmount = booking.cancellationRefundAmountSar ?? 0;

  const isPaid = booking.paymentStatus === "PAID" || booking.paymentStatus === "PARTIAL_REFUND";

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Non-printable header & navigation */}
      <div className="flex items-center justify-between print:hidden">
        <Link
          href={`/admin/bookings/${booking.id}`}
          className="inline-flex items-center gap-2 rounded-xl bg-surface-container-low px-4 py-2 text-sm font-bold text-on-surface shadow-sm transition-colors hover:bg-surface-container-high"
        >
          <ArrowLeft className="size-4" aria-hidden />
          العودة لتفاصيل الحجز
        </Link>
        
        <StatementActionsDropdown bookingId={booking.id} />
      </div>

      {/* Printable Ledger Area */}
      <div className="rounded-2xl border border-outline-variant/30 bg-white p-8 shadow-sm print:m-0 print:border-none print:p-0 print:shadow-none">
        
        {/* Header section */}
        <div className="flex items-start justify-between border-b border-outline-variant/30 pb-6">
          <div className="space-y-1">
            <h1 className="text-2xl font-black text-primary">كشف حساب الحجز</h1>
            <p className="font-mono text-sm font-bold text-on-surface-variant">رقم الطلب: #{booking.id}</p>
            <p className="text-sm text-on-surface-variant">تاريخ الكشف: {new Date().toLocaleDateString("ar-SA")}</p>
          </div>
          <div className="text-left text-sm text-on-surface-variant">
            <div className="flex items-center justify-end gap-1.5 font-bold text-[#003749]">
              <Building2 className="size-4" />
              تأجير السيارات
            </div>
            {booking.pickupBranch ? (
              <p className="mt-1">فرع {booking.pickupBranch.name}</p>
            ) : null}
          </div>
        </div>

        {/* Customer & Booking Summary */}
        <div className="mt-6 grid grid-cols-2 gap-8 text-sm">
          <div>
            <h2 className="mb-3 font-bold text-on-surface-variant">بيانات العميل</h2>
            <div className="space-y-1.5 rounded-xl bg-surface-container-low p-4">
              <p className="font-bold text-on-surface">{booking.fullName}</p>
              <p className="font-mono" dir="ltr">{booking.phone}</p>
              {booking.contactEmail ? <p className="font-mono" dir="ltr">{booking.contactEmail}</p> : null}
            </div>
          </div>
          <div>
            <h2 className="mb-3 font-bold text-on-surface-variant">بيانات الخدمة</h2>
            <div className="space-y-1.5 rounded-xl bg-surface-container-low p-4">
              <p className="font-bold text-on-surface">{carLabel}</p>
              <p className="text-on-surface-variant">المدة: {booking.numberOfDays} {booking.numberOfDays === 1 ? "يوم" : "أيام"}</p>
              <p className="text-on-surface-variant">تاريخ الاستلام: {booking.pickupDate.toLocaleDateString("ar-SA")}</p>
            </div>
          </div>
        </div>

        {/* Line Items Table */}
        <div className="mt-10">
          <h2 className="mb-4 flex items-center gap-2 font-bold text-primary">
            <ReceiptText className="size-5" />
            التفاصيل المالية والرسوم
          </h2>
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b-2 border-outline-variant/40 text-on-surface-variant">
                <th className="py-3 pr-2 font-bold">البند</th>
                <th className="py-3 font-bold">التفاصيل</th>
                <th className="py-3 pl-2 text-left font-bold">المبلغ (غير شامل الضريبة)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {/* Base Rental */}
              <tr>
                <td className="py-3 pr-2 font-semibold text-on-surface">أجرة المركبة</td>
                <td className="py-3 text-on-surface-variant"><SarAmountWithSymbol>{formatSarAmount(effectiveRentalPrice)}</SarAmountWithSymbol> × {booking.numberOfDays} يوم</td>
                <td className="py-3 pl-2 text-left font-mono font-bold text-on-surface"><SarAmountWithSymbol>{formatSarAmount(totals.rentalExclTax)}</SarAmountWithSymbol></td>
              </tr>
              
              {/* Addons */}
              {addons.map((a, i) => (
                <tr key={i}>
                  <td className="py-3 pr-2 font-semibold text-on-surface">إضافة: {a.titleAr}</td>
                  <td className="py-3 text-on-surface-variant"><SarAmountWithSymbol>{formatSarAmount(a.pricePerDayExclTax)}</SarAmountWithSymbol> × {booking.numberOfDays} يوم</td>
                  <td className="py-3 pl-2 text-left font-mono font-bold text-on-surface"><SarAmountWithSymbol>{formatSarAmount(a.pricePerDayExclTax * booking.numberOfDays)}</SarAmountWithSymbol></td>
                </tr>
              ))}

              {/* Inter City Shipping */}
              {interCityShipping ? (
                <tr>
                  <td className="py-3 pr-2 font-semibold text-on-surface">رسوم التوصيل بين المدن</td>
                  <td className="py-3 text-on-surface-variant">لمرة واحدة</td>
                  <td className="py-3 pl-2 text-left font-mono font-bold text-on-surface"><SarAmountWithSymbol>{formatSarAmount(shipFee)}</SarAmountWithSymbol></td>
                </tr>
              ) : null}

              {/* Checkout Fees */}
              {checkoutOneTimeFees.map((fee, i) => (
                <tr key={i}>
                  <td className="py-3 pr-2 font-semibold text-on-surface">{fee.labelAr}</td>
                  <td className="py-3 text-on-surface-variant">لمرة واحدة</td>
                  <td className="py-3 pl-2 text-left font-mono font-bold text-on-surface"><SarAmountWithSymbol>{formatSarAmount(fee.feeExclVatSar)}</SarAmountWithSymbol></td>
                </tr>
              ))}

              {/* Delay Penalty */}
              {delayPenalty ? (
                <tr>
                  <td className="py-3 pr-2 font-semibold text-rose-700">غرامة تأخير تسليم</td>
                  <td className="py-3 text-on-surface-variant">يضاف للرسوم لمرة واحدة</td>
                  <td className="py-3 pl-2 text-left font-mono font-bold text-rose-700"><SarAmountWithSymbol glyphClassName="text-rose-700/70">{formatSarAmount(delayFee)}</SarAmountWithSymbol></td>
                </tr>
              ) : null}
            </tbody>
            <tfoot className="border-t border-outline-variant/40 bg-surface-container-low/30">
              <tr>
                <td colSpan={2} className="py-3 pr-2 font-bold text-on-surface-variant">الإجمالي غير شامل الضريبة</td>
                <td className="py-3 pl-2 text-left font-mono font-bold text-on-surface"><SarAmountWithSymbol>{formatSarAmount(totals.subtotalExclTax)}</SarAmountWithSymbol></td>
              </tr>
              <tr>
                <td colSpan={2} className="py-3 pr-2 font-bold text-on-surface-variant">ضريبة القيمة المضافة ({vatRate}%)</td>
                <td className="py-3 pl-2 text-left font-mono font-bold text-on-surface"><SarAmountWithSymbol>{formatSarAmount(totals.vatAmount)}</SarAmountWithSymbol></td>
              </tr>
              <tr className="border-t-2 border-outline-variant/40 bg-primary/5 text-base">
                <td colSpan={2} className="py-4 pr-2 font-black text-primary">المجموع الكلي (شامل الضريبة)</td>
                <td className="py-4 pl-2 text-left font-mono font-black text-primary"><SarAmountWithSymbol glyphClassName="text-primary/70">{formatSarAmount(totals.totalInclTax)}</SarAmountWithSymbol></td>
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Payments Section */}
        <div className="mt-10">
          <h2 className="mb-4 flex items-center gap-2 font-bold text-primary">
            <Banknote className="size-5" />
            حالة الدفع والمدفوعات
          </h2>
          
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-xl border border-outline-variant/30 p-5">
              <p className="mb-2 text-xs font-bold text-on-surface-variant">حالة الحجز الحالية</p>
              <div className="flex items-center gap-2">
                <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${
                  booking.paymentStatus === "PAID" ? "bg-emerald-100 text-emerald-800"
                  : booking.paymentStatus === "REFUNDED" ? "bg-sky-100 text-sky-800"
                  : booking.paymentStatus === "PARTIAL_REFUND" ? "bg-violet-100 text-violet-800"
                  : "bg-amber-100 text-amber-900"
                }`}>
                  {paymentStatusLabelAr(booking.paymentStatus)}
                </span>
                {booking.paymentMethod ? (
                  <span className="text-sm font-bold text-on-surface">
                    ({bookingPaymentMethodLabelAr(booking.paymentMethod)})
                  </span>
                ) : null}
              </div>
              {booking.paidAt ? (
                <p className="mt-3 text-xs text-on-surface-variant flex items-center gap-1.5">
                  <CalendarClock className="size-3.5" />
                  وقت الدفع: {booking.paidAt.toLocaleString("ar-SA")}
                </p>
              ) : null}
            </div>

            <div className="rounded-xl border border-outline-variant/30 p-5">
              <p className="mb-2 text-xs font-bold text-on-surface-variant">ملخص المستحقات</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">المبلغ المدفوع:</span>
                  <span className="font-mono font-bold text-emerald-700">
                    <SarAmountWithSymbol glyphClassName="text-emerald-700/70">{isPaid ? formatSarAmount(totals.totalInclTax) : "0.00"}</SarAmountWithSymbol>
                  </span>
                </div>
                {balanceDueAtBranch > 0 ? (
                  <div className="flex justify-between border-t border-outline-variant/20 pt-2">
                    <span className="font-bold text-amber-800">مستحق الدفع (في الفرع):</span>
                    <span className="font-mono font-black text-amber-800">
                      <SarAmountWithSymbol glyphClassName="text-amber-800/70">{formatSarAmount(balanceDueAtBranch)}</SarAmountWithSymbol>
                    </span>
                  </div>
                ) : null}
                {refundAmount > 0 ? (
                  <div className="flex justify-between border-t border-outline-variant/20 pt-2">
                    <span className="font-bold text-sky-800">المبلغ المسترد للعميل:</span>
                    <span className="font-mono font-black text-sky-800">
                      <SarAmountWithSymbol glyphClassName="text-sky-800/70">{formatSarAmount(refundAmount)}</SarAmountWithSymbol>
                    </span>
                  </div>
                ) : null}
                {!isPaid && booking.paymentStatus === "PENDING" ? (
                  <div className="flex justify-between border-t border-outline-variant/20 pt-2">
                    <span className="font-bold text-rose-700">المبلغ الإجمالي المتبقي للتحصيل:</span>
                    <span className="font-mono font-black text-rose-700">
                      <SarAmountWithSymbol glyphClassName="text-rose-700/70">{formatSarAmount(totals.totalInclTax)}</SarAmountWithSymbol>
                    </span>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-12 text-center text-xs text-on-surface-variant/70 border-t border-outline-variant/20 pt-6">
          <p>أُصدر هذا الكشف من النظام الآلي لتأجير السيارات.</p>
          <p>معرف الوثيقة: STMT-B{booking.id}-{Date.now().toString().slice(-6)}</p>
        </div>
      </div>
    </div>
  );
}
