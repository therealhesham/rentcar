import { notFound } from "next/navigation";
import { assertBookingRequestInScope } from "@/lib/admin-access";
import { requireAdminPage } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { BookingFinanceOperationsPanel } from "@/components/admin/BookingFinanceOperationsPanel";
import { BookingPaymentPanel } from "@/components/admin/BookingPaymentPanel";
import { SarAmountWithSymbol } from "@/components/ui/SarAmountWithSymbol";
import { formatSarAmount } from "@/lib/booking-checkout-pricing";
import { bookingPaymentMethodLabelAr } from "@/lib/booking-payment-method-label";

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
      cancellationRefundAmountSar: true,
      balanceDueAtBranchSar: true,
    },
  });

  if (!booking) notFound();

  const statusKey = booking.paymentStatus.trim().toUpperCase();
  const canPay    = statusKey !== "PAID" && statusKey !== "REFUNDED";

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
          {/* ملخص الدفع */}
          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-bold text-on-surface">ملخص الدفع</h3>
            <dl className="space-y-3 text-sm">
              {/* حالة الدفع */}
              <div className="flex items-center justify-between gap-2">
                <dt className="font-medium text-on-surface-variant">الحالة</dt>
                <dd>
                  <span
                    className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${paymentStatusStyles(booking.paymentStatus)}`}
                  >
                    {paymentStatusLabelAr(booking.paymentStatus)}
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
