import Link from "next/link";
import { CalendarX2, Clock, Car } from "lucide-react";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { adminBranchDisplayName } from "@/lib/admin-access";
import { requireAdminPage } from "@/lib/admin-page";
import {
  MISSED_PICKUP_GRACE_HOURS,
  daysOverdue,
  loadMissedBookings,
} from "@/lib/admin-missed-bookings";
import { bookingStatusLabelAr, bookingPaymentStatusLabelAr } from "@/lib/booking-display-labels";

export const dynamic = "force-dynamic";

function StatTile({
  label,
  value,
  hint,
  icon: Icon,
  accent,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: typeof CalendarX2;
  accent: string;
}) {
  return (
    <div className="flex gap-4 rounded-2xl border border-outline-variant/25 bg-white p-5 shadow-[0_4px_24px_-10px_rgba(28,27,27,0.1)]">
      <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent}`}>
        <Icon className="h-5 w-5" aria-hidden />
      </div>
      <div className="min-w-0">
        <p className="text-xs font-bold text-on-surface-variant">{label}</p>
        <p className="mt-1 text-2xl font-extrabold tabular-nums tracking-tight text-[#003749]">
          {value}
        </p>
        {hint ? <p className="mt-0.5 text-[11px] text-on-surface-variant">{hint}</p> : null}
      </div>
    </div>
  );
}

function fmtDate(d: Date): string {
  return d.toLocaleDateString("ar-SA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function AdminMissedBookingsPage() {
  const session = await requireAdminPage();
  const now = new Date();
  const rows = await loadMissedBookings(session, {}, 200, now);

  const branchHint = session.isSuperAdmin
    ? "كل الفروع"
    : `فرع ${adminBranchDisplayName(session)}`;

  return (
    <>
      <AdminPageHeader
        title="حجوزات فائتة"
        description={
          <>
            حجوزات مباشرة لم تُستلَم سياراتها ومرّ على موعد الاستلام أكثر من{" "}
            <span className="font-bold text-on-surface">{MISSED_PICKUP_GRACE_HOURS} ساعة</span>.
            النطاق: {branchHint}.
          </>
        }
        backHref="/admin/car-bookings"
        backLabel="حجوزات السيارات"
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatTile
          label="حجوزات فائتة"
          value={rows.length}
          hint="لم تُستلم بعد الموعد"
          icon={CalendarX2}
          accent="bg-[#fef2f2] text-[#b91c1c]"
        />
        <StatTile
          label="مهلة السماح"
          value={`${MISSED_PICKUP_GRACE_HOURS} ساعة`}
          hint="قبل اعتبار الحجز فائتاً"
          icon={Clock}
          accent="bg-[#fff7ed] text-[#9a3412]"
        />
        <StatTile
          label="النطاق"
          value={branchHint}
          icon={Car}
          accent="bg-[#eff6ff] text-[#1d4ed8]"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-outline-variant/25 bg-white shadow-[0_4px_24px_-10px_rgba(28,27,27,0.1)]">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b border-outline-variant/30 bg-surface-container-low/40 text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                <th className="px-4 py-3">الحجز</th>
                <th className="px-4 py-3">العميل</th>
                <th className="px-4 py-3">السيارة</th>
                <th className="px-4 py-3">موعد الاستلام</th>
                <th className="px-4 py-3">التأخير</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3">الدفع</th>
                <th className="px-4 py-3">الفرع</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-on-surface-variant">
                    لا توجد حجوزات فائتة حالياً.
                  </td>
                </tr>
              ) : (
                rows.map((b) => {
                  const overdue = daysOverdue(b.pickupDate, now);
                  return (
                    <tr key={b.id} className="transition-colors hover:bg-surface-container/30">
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/bookings/${b.id}`}
                          className="font-bold text-primary hover:underline"
                          dir="ltr"
                        >
                          #{b.id}
                        </Link>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-bold text-on-surface">{b.fullName}</div>
                        <div className="text-xs text-on-surface-variant" dir="ltr">
                          {b.phone}
                        </div>
                      </td>
                      <td className="px-4 py-3">{b.carLabel}</td>
                      <td className="px-4 py-3 text-xs text-on-surface-variant" dir="ltr">
                        {fmtDate(b.pickupDate)}
                      </td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-red-50 px-2.5 py-0.5 text-[11px] font-bold text-red-800 ring-1 ring-inset ring-red-200/60">
                          {overdue >= 1 ? `${overdue} يوم` : "أقل من يوم"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs font-bold">
                        {bookingStatusLabelAr(b.status)}
                      </td>
                      <td className="px-4 py-3 text-xs font-bold">
                        {bookingPaymentStatusLabelAr(b.paymentStatus)}
                      </td>
                      <td className="px-4 py-3 text-xs text-on-surface-variant">
                        {b.pickupBranchName}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
