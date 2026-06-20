import { notFound } from "next/navigation";
import { assertBookingRequestInScope } from "@/lib/admin-access";
import { requireAdminPage } from "@/lib/admin-page";
import { prisma } from "@/lib/prisma";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { BookingFinanceOperationsPanel } from "@/components/admin/BookingFinanceOperationsPanel";
import { SarAmountWithSymbol } from "@/components/ui/SarAmountWithSymbol";
import { formatSarAmount } from "@/lib/booking-checkout-pricing";

export const dynamic = "force-dynamic";

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
      paymentStatus: true,
      paymentMethod: true,
      cancellationRefundAmountSar: true,
      balanceDueAtBranchSar: true,
      fullName: true,
      status: true,
      kind: true,
    }
  });

  if (!booking) notFound();

  return (
    <div className="mx-auto max-w-4xl space-y-8">
      <AdminPageHeader
        backHref={`/admin/bookings/${id}`}
        backLabel={`حجز #${id}`}
        title="العمليات المالية"
        description={`إدارة الأمور المالية المتعلقة بحجز ${booking.fullName}`}
      />

      <div className="grid gap-6 md:grid-cols-[1fr_320px] items-start">
        <div className="space-y-6">
          <BookingFinanceOperationsPanel
            bookingId={id}
            paymentStatus={booking.paymentStatus}
            currentRefundAmount={booking.cancellationRefundAmountSar || 0}
          />
        </div>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-outline-variant/30 bg-surface-container-lowest p-5 shadow-sm">
            <h3 className="mb-4 text-sm font-bold text-on-surface">ملخص الدفع الحالي</h3>
            <dl className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <dt className="text-on-surface-variant font-medium">حالة الدفع</dt>
                <dd className="font-bold text-on-surface">{booking.paymentStatus}</dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-on-surface-variant font-medium">طريقة الدفع</dt>
                <dd className="font-bold text-on-surface">{booking.paymentMethod || "—"}</dd>
              </div>
              <div className="flex justify-between items-center">
                <dt className="text-on-surface-variant font-medium">إجمالي المسترد</dt>
                <dd className="font-bold text-emerald-700">
                  <SarAmountWithSymbol>{formatSarAmount(booking.cancellationRefundAmountSar || 0)}</SarAmountWithSymbol>
                </dd>
              </div>
              {booking.balanceDueAtBranchSar ? (
                <div className="flex justify-between items-center">
                  <dt className="text-on-surface-variant font-medium">مستحق عند الفرع</dt>
                  <dd className="font-bold text-amber-700">
                    <SarAmountWithSymbol>{formatSarAmount(booking.balanceDueAtBranchSar)}</SarAmountWithSymbol>
                  </dd>
                </div>
              ) : null}
            </dl>
          </div>
        </aside>
      </div>
    </div>
  );
}
