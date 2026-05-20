import Link from "next/link";
import { Ban, CalendarX2, Phone, Receipt, User } from "lucide-react";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import type { CancelledBookingRow } from "@/lib/admin-cancelled-bookings";
import {
  cancelledAtSortKey,
  formatCancelledMonthTitleAr,
  formatPickupRangeAr,
} from "@/lib/admin-cancelled-bookings";
import { bookingPaymentMethodLabelAr } from "@/lib/booking-payment-method-label";
import { bookingPaymentStatusLabelAr } from "@/lib/booking-display-labels";

function formatWhen(d: Date): string {
  return d.toLocaleString("ar-SA", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function groupByMonth(rows: CancelledBookingRow[]): { ym: string; rows: CancelledBookingRow[] }[] {
  const map = new Map<string, CancelledBookingRow[]>();
  for (const row of rows) {
    const key = cancelledAtSortKey(row);
    const list = map.get(key) ?? [];
    list.push(row);
    map.set(key, list);
  }
  return [...map.entries()]
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([ym, list]) => ({ ym, rows: list }));
}

function CancelledBookingCard({ row }: { row: CancelledBookingRow }) {
  const when = row.cancelledAt ?? row.updatedAt;
  const hasRefund =
    row.cancellationRefundAmountSar != null && row.cancellationRefundAmountSar > 0;

  return (
    <article className="group relative overflow-hidden rounded-2xl border border-[#fecaca]/60 bg-white shadow-[0_4px_24px_-12px_rgba(28,27,27,0.12)] transition-shadow hover:shadow-[0_8px_32px_-12px_rgba(28,27,27,0.18)]">
      <div className="absolute inset-y-0 start-0 w-1 bg-[#dc2626]" aria-hidden />
      <div className="p-5 ps-6 sm:p-6 sm:ps-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-xs font-bold tabular-nums text-on-surface-variant" dir="ltr">
              #{row.id}
            </span>
            <AdminStatusBadge status="CANCELLED" />
          </div>
          <Link
            href={`/admin/bookings/${row.id}`}
            className="rounded-xl bg-primary-container px-3.5 py-2 text-xs font-bold text-on-primary-container transition-colors hover:bg-primary/90 hover:text-on-primary"
          >
            التفاصيل
          </Link>
        </div>

        <h3 className="mt-3 text-lg font-extrabold tracking-tight text-[#003749]">{row.carLabel}</h3>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
          <div className="flex gap-2">
            <User className="mt-0.5 h-4 w-4 shrink-0 text-on-surface-variant" aria-hidden />
            <div>
              <dt className="text-[11px] font-bold text-on-surface-variant">العميل</dt>
              <dd className="font-bold">{row.fullName}</dd>
            </div>
          </div>
          <div className="flex gap-2">
            <Phone className="mt-0.5 h-4 w-4 shrink-0 text-on-surface-variant" aria-hidden />
            <div>
              <dt className="text-[11px] font-bold text-on-surface-variant">الجوال</dt>
              <dd dir="ltr" className="font-mono font-bold tabular-nums">
                <a href={`tel:${row.phone.replace(/\s/g, "")}`} className="text-primary hover:underline">
                  {row.phone}
                </a>
              </dd>
            </div>
          </div>
          <div className="flex gap-2">
            <CalendarX2 className="mt-0.5 h-4 w-4 shrink-0 text-on-surface-variant" aria-hidden />
            <div>
              <dt className="text-[11px] font-bold text-on-surface-variant">أُلغي في</dt>
              <dd className="text-xs font-medium">{formatWhen(when)}</dd>
            </div>
          </div>
        </dl>

        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="rounded-lg bg-surface-container-low px-2.5 py-1.5 font-bold text-on-surface">
            الاستلام: {row.pickupBranchName}
          </span>
          <span className="rounded-lg bg-surface-container-low px-2.5 py-1.5 font-bold text-on-surface">
            الإرجاع: {row.returnBranchName}
          </span>
          <span className="rounded-lg bg-surface-container-low px-2.5 py-1.5 font-mono tabular-nums" dir="ltr">
            {formatPickupRangeAr(row.pickupDate, row.numberOfDays)}
          </span>
          {row.pickupMode === "DELIVERY" ? (
            <span className="rounded-lg bg-[#eff6ff] px-2.5 py-1.5 font-bold text-[#1d4ed8]">توصيل</span>
          ) : null}
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-outline-variant/15 pt-4 text-xs">
          <span className="inline-flex items-center gap-1.5 font-bold text-on-surface-variant">
            <Receipt className="h-3.5 w-3.5" aria-hidden />
            {bookingPaymentStatusLabelAr(row.paymentStatus)}
            {row.paymentMethod ? (
              <span className="font-normal">· {bookingPaymentMethodLabelAr(row.paymentMethod)}</span>
            ) : null}
          </span>
          {row.cancellationDeductedDays != null && row.cancellationDeductedDays > 0 ? (
            <span className="rounded-full bg-[#fff7ed] px-2.5 py-1 font-bold text-[#9a3412] ring-1 ring-[#fdba74]/40 ring-inset">
              خصم {row.cancellationDeductedDays} يوم
            </span>
          ) : null}
          {hasRefund ? (
            <span className="rounded-full bg-[#ecfdf5] px-2.5 py-1 font-bold text-[#047857] ring-1 ring-[#6ee7b7]/40 ring-inset">
              استرداد {row.cancellationRefundAmountSar!.toLocaleString("ar-SA")} ر.س
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}

type Props = {
  rows: CancelledBookingRow[];
  hasSearch: boolean;
};

export function CancelledBookingsList({ rows, hasSearch }: Props) {
  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center rounded-2xl border border-dashed border-outline-variant/40 bg-surface-container-low/50 px-6 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#fef2f2] text-[#b91c1c]">
          <Ban className="h-7 w-7" aria-hidden />
        </div>
        <p className="mt-4 text-lg font-extrabold text-on-surface">
          {hasSearch ? "لا توجد نتائج للبحث" : "لا توجد حجوزات ملغاة"}
        </p>
        <p className="mt-2 max-w-md text-sm text-on-surface-variant">
          {hasSearch
            ? "جرّب اسماً أو رقماً مختلفاً، أو أزل عوامل التصفية."
            : "عند إلغاء حجز مباشر سيظهر هنا مع تفاصيل الاسترداد والخصم."}
        </p>
      </div>
    );
  }

  const groups = groupByMonth(rows);

  return (
    <div className="space-y-10">
      {groups.map(({ ym, rows: monthRows }) => (
        <section key={ym}>
          <h2 className="mb-4 flex flex-wrap items-baseline gap-2 text-lg font-extrabold text-[#003749]">
            {formatCancelledMonthTitleAr(ym)}
            <span className="text-sm font-medium text-on-surface-variant">
              ({monthRows.length})
            </span>
          </h2>
          <div className="grid gap-4 lg:grid-cols-2">
            {monthRows.map((row) => (
              <CancelledBookingCard key={row.id} row={row} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
