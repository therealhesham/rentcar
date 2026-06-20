import Link from "next/link";
import {
  ArrowLeft,
  Calendar,
  Car,
  MapPin,
  Pencil,
  Phone,
  Truck,
  User,
  CreditCard,
} from "lucide-react";
import { AdminStatusBadge } from "@/components/admin/AdminStatusBadge";
import { BookingListQuickActions } from "@/components/admin/BookingListQuickActions";
import { AdminQuickPaymentModal } from "@/components/admin/AdminQuickPaymentModal";

export type CarBookingRow = {
  id: number;
  fullName: string;
  phone: string;
  carLabel: string;
  startYmd: string;
  endYmd: string;
  numberOfDays: number;
  pickupBranchName: string;
  returnBranchName: string;
  pickupMode: string | null;
  deliveryAddress: string | null;
  deliveryLat: number | null;
  deliveryLng: number | null;
  status: string;
  kind: "INQUIRY" | "DIRECT";
  carModelId: number | null;
  paymentStatus: string | null;
};

export type CarBookingDayGroup = {
  ymd: string;
  sectionTitle: string;
  rows: CarBookingRow[];
};

type Props = {
  groups: CarBookingDayGroup[];
};

function PickupModeCell({ row }: { row: CarBookingRow }) {
  if (row.pickupMode === "DELIVERY") {
    return (
      <span className="inline-flex max-w-[min(100%,240px)] flex-col gap-1">
        <span className="inline-flex w-fit items-center gap-1 rounded-full bg-[#eff6ff] px-2 py-0.5 text-[11px] font-bold text-[#1d4ed8]">
          <Truck className="size-3" aria-hidden />
          توصيل
        </span>
        {row.deliveryAddress?.trim() ? (
          <span className="line-clamp-2 text-xs leading-snug text-on-surface">
            {row.deliveryAddress.trim()}
          </span>
        ) : null}
        {row.deliveryLat != null && row.deliveryLng != null ? (
          <a
            href={`https://www.google.com/maps?q=${row.deliveryLat},${row.deliveryLng}`}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-bold text-primary hover:underline"
            dir="ltr"
          >
            <MapPin className="size-3" aria-hidden />
            الخريطة
          </a>
        ) : !row.deliveryAddress?.trim() ? (
          <span className="text-xs text-on-surface-variant">بدون عنوان</span>
        ) : null}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1 text-xs font-bold text-on-surface-variant">
      <MapPin className="size-3.5 shrink-0" aria-hidden />
      من الفرع
    </span>
  );
}

function BookingActions({ row }: { row: CarBookingRow }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-3">
        <Link
          href={`/admin/bookings/${row.id}`}
          className="inline-flex items-center gap-1 text-sm font-bold text-primary hover:underline"
        >
          <ArrowLeft className="size-3.5" aria-hidden />
          التفاصيل
        </Link>
        <Link
          href={`/admin/bookings/${row.id}?edit=1`}
          className="inline-flex items-center justify-center rounded p-1.5 text-on-surface-variant hover:bg-surface-container-high hover:text-primary transition-colors"
          title="تعديل"
        >
          <Pencil className="size-4" aria-hidden />
        </Link>
      </div>
      <div className="flex flex-wrap items-center gap-1.5">
        {row.paymentStatus?.trim().toUpperCase() !== "PAID" && (
          <AdminQuickPaymentModal bookingId={row.id} />
        )}
        <BookingListQuickActions
          bookingId={row.id}
          status={row.status}
          kind={row.kind}
          carModelId={row.carModelId}
        />
      </div>
    </div>
  );
}

export function AdminCarBookingsList({ groups }: Props) {
  if (groups.length === 0) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-outline-variant/25 bg-white px-6 py-14 text-center shadow-[0_4px_24px_-10px_rgba(28,27,27,0.1)]">
        <div className="grid size-14 place-items-center rounded-2xl bg-surface-container-low text-on-surface-variant">
          <Calendar className="size-7" aria-hidden />
        </div>
        <div>
          <p className="font-bold text-on-surface">لا توجد حجوزات نشطة حالياً</p>
          <p className="mt-1 max-w-sm text-sm text-on-surface-variant">
            الحجوزات الملغاة والمكتملة لا تظهر هنا. يمكنك تسجيل حجز جديد من المكتب.
          </p>
        </div>
        <Link
          href="/admin/direct-booking"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-bold text-on-primary hover:opacity-95"
        >
          حجز مباشر من المكتب
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {groups.map((group) => (
        <section
          key={group.ymd}
          className="overflow-hidden rounded-2xl border border-outline-variant/25 bg-white shadow-[0_4px_24px_-10px_rgba(28,27,27,0.1)]"
        >
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-outline-variant/15 bg-surface-container-low/40 px-5 py-4 sm:px-6">
            <div>
              <h2 className="text-lg font-extrabold tracking-tight text-primary">
                {group.sectionTitle}
              </h2>
              <p className="mt-0.5 font-mono text-xs font-bold text-on-surface-variant" dir="ltr">
                {group.ymd}
              </p>
            </div>
            <span className="rounded-full bg-primary-container/50 px-3 py-1 text-xs font-bold text-primary">
              {group.rows.length} {group.rows.length === 1 ? "حجز" : "حجوزات"}
            </span>
          </div>

          {/* Mobile */}
          <ul className="divide-y divide-outline-variant/15 md:hidden">
            {group.rows.map((row) => (
              <li key={row.id} className="px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <AdminStatusBadge status={row.status} />
                      <span className="tabular-nums text-xs font-bold text-on-surface-variant" dir="ltr">
                        #{row.id}
                      </span>
                    </div>
                    <p className="mt-2 font-extrabold text-on-surface">{row.fullName}</p>
                    <p className="mt-0.5 flex items-center gap-1.5 text-sm text-on-surface-variant">
                      <Phone className="size-3.5 shrink-0" aria-hidden />
                      <span dir="ltr" className="tabular-nums">
                        {row.phone}
                      </span>
                    </p>
                  </div>
                  <BookingActions row={row} />
                </div>

                <dl className="mt-3 space-y-2 text-sm">
                  <div className="flex items-start gap-2">
                    <Car className="mt-0.5 size-4 shrink-0 text-on-surface-variant" aria-hidden />
                    <div>
                      <dd className="font-semibold text-on-surface">{row.carLabel}</dd>
                      <dd className="mt-0.5 text-xs tabular-nums text-on-surface-variant" dir="ltr">
                        {row.startYmd} → {row.endYmd} · {row.numberOfDays} يوم
                      </dd>
                    </div>
                  </div>
                  <div className="flex items-start gap-2 text-xs text-on-surface-variant">
                    <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                    <span>
                      استلام: {row.pickupBranchName} · إرجاع: {row.returnBranchName}
                    </span>
                  </div>
                  <div className="pt-1">
                    <PickupModeCell row={row} />
                  </div>
                </dl>
              </li>
            ))}
          </ul>

          {/* Desktop */}
          <div className="hidden overflow-x-auto md:block">
            <table className="w-full min-w-[960px] text-start text-sm">
              <thead className="sticky top-0 z-10 bg-white shadow-[0_1px_0_0_rgba(0,0,0,0.06)]">
                <tr className="border-b border-outline-variant/20 bg-surface-container-low/60 text-[11px] font-bold uppercase tracking-wide text-on-surface-variant">
                  <th className="px-4 py-3">العميل</th>
                  <th className="px-4 py-3">السيارة</th>
                  <th className="px-4 py-3">المدة</th>
                  <th className="px-4 py-3">الفروع</th>
                  <th className="px-4 py-3">الاستلام</th>
                  <th className="px-4 py-3">الحالة</th>
                  <th className="px-4 py-3">#</th>
                  <th className="px-4 py-3">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row, i) => (
                  <tr
                    key={row.id}
                    className={`border-b border-outline-variant/10 transition-colors hover:bg-surface-container-low/50 ${
                      i % 2 === 1 ? "bg-surface-container-low/20" : ""
                    }`}
                  >
                    <td className="px-4 py-3 align-top">
                      <span className="flex items-center gap-1.5 font-semibold text-on-surface">
                        <User className="size-3.5 shrink-0 text-on-surface-variant" aria-hidden />
                        {row.fullName}
                      </span>
                      <span className="mt-0.5 block tabular-nums text-xs text-on-surface-variant" dir="ltr">
                        {row.phone}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top font-medium text-on-surface">{row.carLabel}</td>
                    <td className="px-4 py-3 align-top">
                      <span className="block tabular-nums text-on-surface" dir="ltr">
                        {row.startYmd} → {row.endYmd}
                      </span>
                      <span className="mt-0.5 block text-xs text-on-surface-variant">
                        {row.numberOfDays} يوم
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top text-xs">
                      <span className="block text-on-surface">استلام: {row.pickupBranchName}</span>
                      <span className="mt-0.5 block text-on-surface-variant">
                        إرجاع: {row.returnBranchName}
                      </span>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <PickupModeCell row={row} />
                    </td>
                    <td className="px-4 py-3 align-top">
                      <AdminStatusBadge status={row.status} />
                    </td>
                    <td className="px-4 py-3 align-top tabular-nums text-xs font-bold text-on-surface-variant">
                      #{row.id}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <BookingActions row={row} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  );
}
