import Link from "next/link";
import { requireAdminPagePermission } from "@/lib/admin-page";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import { formatSar } from "@/lib/admin-statistics";
import { bookingPaymentStatusLabelAr } from "@/lib/booking-display-labels";
import {
  getCompanyDuesPosition,
  getCompanyReceivableBookings,
} from "@/lib/company-dues";

export const dynamic = "force-dynamic";

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("ar-SA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export default async function CompanyDuesPage() {
  const session = await requireAdminPagePermission("FINANCIALS");
  const scope = { isSuperAdmin: session.isSuperAdmin, branchId: session.branchId };

  const [position, receivables] = await Promise.all([
    getCompanyDuesPosition(scope),
    getCompanyReceivableBookings(scope),
  ]);

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="مستحقات للشركة"
        description="أرصدة مستحقة على العملاء تُحصَّل عند الفرع (فروقات تمديد أو تعديل رفع إجمالي الحجز)."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <AdminStatCard
          label="مستحقات للشركة"
          value={`${formatSar(position.receivables.totalSar)} ر.س`}
          highlight={position.receivables.totalSar > 0}
          hint={`${position.receivables.count} حجز قائم`}
        />
        <AdminStatCard
          label="مستحقات على الشركة"
          value={`${formatSar(position.payables.totalSar)} ر.س`}
          href="/admin/customer-dues"
          hint={`${position.payables.count} حجز — للعملاء`}
        />
        <AdminStatCard
          label="صافي المستحقات"
          value={`${formatSar(position.netSar)} ر.س`}
          hint={
            position.netSar >= 0
              ? "لصالح الشركة"
              : "على الشركة"
          }
        />
      </div>

      <AdminCard
        title="حجوزات عليها رصيد للشركة"
        description="الرصيد يُحصَّل نقداً عند تسليم/إرجاع المركبة، ويُسجَّل من صفحة العمليات المالية للحجز."
      >
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b border-outline-variant/30 text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                <th className="pb-3 pr-2">الحجز</th>
                <th className="pb-3">العميل</th>
                <th className="pb-3">السيارة</th>
                <th className="pb-3">الرصيد المستحق</th>
                <th className="pb-3">حالة الدفع</th>
                <th className="pb-3">تاريخ الاستلام</th>
                <th className="pb-3">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {receivables.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-on-surface-variant">
                    لا توجد أرصدة مستحقة للشركة حالياً.
                  </td>
                </tr>
              ) : (
                receivables.map((b) => (
                  <tr key={b.id} className="transition-colors hover:bg-surface-container/30">
                    <td className="py-3 pr-2">
                      <Link
                        href={`/admin/bookings/${b.id}`}
                        className="font-bold text-primary hover:underline"
                        dir="ltr"
                      >
                        #{b.id}
                      </Link>
                    </td>
                    <td className="py-3">
                      <div className="font-bold text-on-surface">{b.fullName}</div>
                      <div className="text-xs text-on-surface-variant" dir="ltr">
                        {b.phone}
                      </div>
                    </td>
                    <td className="py-3">
                      {b.carModel
                        ? `${b.carModel.brand.name} ${b.carModel.name}`.trim()
                        : b.carType || "—"}
                    </td>
                    <td className="py-3 font-extrabold text-amber-800 tabular-nums" dir="ltr">
                      {formatSar(b.balanceDueAtBranchSar ?? 0)} ر.س
                    </td>
                    <td className="py-3 text-xs font-bold">
                      {bookingPaymentStatusLabelAr(b.paymentStatus)}
                    </td>
                    <td className="py-3 text-xs text-on-surface-variant" dir="ltr">
                      {fmtDate(b.pickupDate)}
                    </td>
                    <td className="py-3">
                      <Link
                        href={`/admin/bookings/${b.id}/finance`}
                        className="rounded-lg bg-[#003749] px-3 py-1.5 text-xs font-extrabold text-white hover:opacity-95"
                      >
                        تسجيل تحصيل
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </div>
  );
}
