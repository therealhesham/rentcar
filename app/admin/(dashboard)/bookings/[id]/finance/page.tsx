import { notFound } from "next/navigation";
import { assertBookingRequestInScope } from "@/lib/admin-access";
import { requireAdminPage } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { BookingExtraChargesPanel } from "@/components/admin/BookingExtraChargesPanel";
import { BookingFinanceOperationsPanel } from "@/components/admin/BookingFinanceOperationsPanel";
import { BookingPaymentPanel } from "@/components/admin/BookingPaymentPanel";
import { SarAmountWithSymbol } from "@/components/ui/SarAmountWithSymbol";
import { formatSarAmount } from "@/lib/booking-checkout-pricing";
import {
  EXTRA_CHARGE_KINDS,
  extraChargeKindLabelAr,
  getBookingExtraCharges,
} from "@/lib/booking-extra-charges";
import { bookingPaymentMethodLabelAr } from "@/lib/booking-payment-method-label";
import { computeBookingOutstanding } from "@/lib/booking-outstanding";
import { getBookingPaymentTransactions } from "@/lib/payment-transaction";

export const dynamic = "force-dynamic";

/** تسمية عربية ولون لكل نوع حركة في دفتر الحجز. */
const TXN_KIND_UI: Record<string, { label: string; className: string }> = {
  INITIAL_PAYMENT: { label: "دفعة أولى", className: "bg-emerald-50 text-emerald-700 ring-emerald-200/60" },
  BALANCE_PAYMENT: { label: "سداد فرق", className: "bg-teal-50 text-teal-700 ring-teal-200/60" },
  LATE_PENALTY: { label: "غرامة تأخير", className: "bg-purple-50 text-purple-700 ring-purple-200/60" },
  REFUND: { label: "استرداد", className: "bg-red-50 text-red-700 ring-red-200/60" },
  REFUND_REVERSAL: { label: "عكس استرداد", className: "bg-sky-50 text-sky-700 ring-sky-200/60" },
  CUSTOMER_SETTLEMENT: { label: "تسوية للعميل", className: "bg-orange-50 text-orange-700 ring-orange-200/60" },
};

const TXN_ACTOR_LABEL: Record<string, string> = {
  CUSTOMER: "العميل",
  ADMIN: "موظف",
  GATEWAY: "بوابة الدفع",
  SYSTEM: "النظام",
};

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
  const session = await requireAdminPage();
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
  const bookingStatusKey = booking.status.trim().toUpperCase();
  const isTerminalBooking =
    bookingStatusKey === "CANCELLED" || bookingStatusKey === "REJECTED";

  // «رصيد التحصيل» من المصدر الموحّد (نفس ما يُعرض للموظف عند استلام السيارة).
  const { totalInclTax: totalAmountSar, outstandingDueSar, balanceDueAtBranchSar } =
    computeBookingOutstanding(booking);

  const [ledger, extraCharges] = await Promise.all([
    getBookingPaymentTransactions(id),
    getBookingExtraCharges(id, balanceDueAtBranchSar),
  ]);
  // إجمالي ما على الحجز = الإيجار + الرسوم الإضافية السارية، حتى تتصالح المعادلة
  // «الكلي − المدفوع = المتبقي». الحجز الملغى تسقط عنه الرسوم كما يسقط رصيده.
  const extraChargesInTotalSar = isTerminalBooking ? 0 : extraCharges.activeTotalInclTaxSar;
  const grandTotalSar = Math.round((totalAmountSar + extraChargesInTotalSar) * 100) / 100;

  // ما يُطالَب به العميل الآن = متبقي الإيجار + المستحق عند الفرع (فروق التمديد والرسوم الإضافية).
  const totalDueNowSar = Math.round((outstandingDueSar + balanceDueAtBranchSar) * 100) / 100;
  const isPartiallyPaid = statusKey === "PAID" && totalDueNowSar > 0;
  // سقف الدفعة يطابق ما يقبله الخادم: عند PAID يحصّل الرصيد فقط، وقبلها الإيجار + الرسوم.
  const collectibleNowSar = statusKey === "PAID" ? balanceDueAtBranchSar : totalDueNowSar;

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
              fullAmountSar={collectibleNowSar}
            />
          ) : null}

          {/* رسوم إضافية — تلفيات ووقود ومخالفات تُضاف لرصيد التحصيل */}
          <BookingExtraChargesPanel
            bookingId={id}
            charges={extraCharges.charges}
            activeTotalInclTaxSar={extraCharges.activeTotalInclTaxSar}
            unsettledTotalInclTaxSar={extraCharges.unsettledTotalInclTaxSar}
            unsettledCount={extraCharges.unsettledCount}
            kindOptions={EXTRA_CHARGE_KINDS.map((k) => ({
              value: k,
              label: extraChargeKindLabelAr(k),
            }))}
            disabled={isTerminalBooking}
            disabledReason="لا يمكن إضافة رسوم على حجز ملغى أو مرفوض."
          />

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
                {formatSarAmount(grandTotalSar)}
              </SarAmountWithSymbol>
            </div>
            {extraChargesInTotalSar > 0 ? (
              <p className="mt-2 text-[11px] font-semibold text-white/60">
                إيجار{" "}
                <span dir="ltr" className="tabular-nums">
                  {formatSarAmount(totalAmountSar)}
                </span>{" "}
                + رسوم إضافية{" "}
                <span dir="ltr" className="tabular-nums">
                  {formatSarAmount(extraChargesInTotalSar)}
                </span>
              </p>
            ) : null}
            {totalDueNowSar > 0 ? (
              <p className="mt-3 flex items-center gap-1.5 text-xs font-semibold text-amber-200">
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-300" />
                متبقٍ للتحصيل:{" "}
                <SarAmountWithSymbol
                  amountClassName="font-bold text-amber-200"
                  glyphClassName="text-amber-200/70"
                >
                  {formatSarAmount(totalDueNowSar)}
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

              {/* تفصيل: كم من المستحق *الباقي* سببه رسوم إضافية.
                  يظهر فقط مع وجود رصيد قائم — بعد التحصيل لم تعد هناك رسوم مستحقة. */}
              {extraCharges.unsettledTotalInclTaxSar > 0 ? (
                <div className="flex items-center justify-between gap-2 ps-3">
                  <dt className="text-xs font-medium text-on-surface-variant">
                    ↳ منها رسوم إضافية ({extraCharges.unsettledCount})
                  </dt>
                  <dd className="text-xs font-bold text-amber-700">
                    <SarAmountWithSymbol>
                      {formatSarAmount(extraCharges.unsettledTotalInclTaxSar)}
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

      {/* دفتر الحجز — كل حركة مالية على هذا الحجز كسطر مستقل */}
      <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-sm">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h3 className="text-sm font-bold text-on-surface">دفتر الحجز</h3>
          <span className="text-xs text-on-surface-variant">
            {ledger.length} حركة
          </span>
        </div>
        {ledger.length === 0 ? (
          <p className="py-6 text-center text-xs text-on-surface-variant">
            لا توجد حركات مسجّلة لهذا الحجز بعد.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b border-outline-variant/30 text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                  <th className="pb-3">النوع</th>
                  <th className="pb-3">المبلغ (ر.س)</th>
                  <th className="pb-3">الوسيلة</th>
                  <th className="pb-3">المنفّذ</th>
                  <th className="pb-3">المرجع</th>
                  <th className="pb-3">التاريخ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant/20">
                {ledger.map((t) => {
                  const ui =
                    TXN_KIND_UI[t.kind] ?? {
                      label: t.kind,
                      className: "bg-surface-container text-on-surface-variant ring-outline-variant/30",
                    };
                  const isDebit = t.direction === "DEBIT";
                  const ref = t.externalRef || t.gatewayRef || "—";
                  const actor = TXN_ACTOR_LABEL[t.actorKind] ?? t.actorKind;
                  return (
                    <tr key={t.id}>
                      <td className="py-3">
                        <span
                          className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-black ring-1 ring-inset ${ui.className}`}
                        >
                          {ui.label}
                        </span>
                      </td>
                      <td
                        className={`py-3 font-extrabold tabular-nums ${isDebit ? "text-error" : "text-emerald-700"}`}
                        dir="ltr"
                      >
                        {isDebit ? "−" : "+"}
                        {formatSarAmount(t.amountSar)}
                      </td>
                      <td className="py-3 text-xs text-on-surface-variant">
                        {bookingPaymentMethodLabelAr(t.method)}
                      </td>
                      <td className="py-3 text-xs">
                        <span className="font-bold text-on-surface">{actor}</span>
                        {t.actorName ? (
                          <div className="text-[11px] text-on-surface-variant">{t.actorName}</div>
                        ) : null}
                      </td>
                      <td className="py-3 text-[11px] text-on-surface-variant" dir="ltr">
                        {ref}
                      </td>
                      <td className="py-3 text-xs text-on-surface-variant">
                        {t.createdAt.toLocaleString("ar-SA", { timeZone: "Asia/Riyadh" })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
