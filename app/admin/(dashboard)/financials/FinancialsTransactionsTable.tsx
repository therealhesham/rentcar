"use client";

import Link from "next/link";
import { RegisterBookingPaymentModal } from "./RegisterBookingPaymentModal";
import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { ChevronRight, ChevronLeft } from "lucide-react";

type BookingRow = {
  id: number;
  fullName: string;
  carModel: { name: string; brand: { name: string } } | null;
  carType: string;
  paymentStatus: string;
  paymentMethod: string | null;
};

type Props = {
  bookings: BookingRow[];
  totalCount: number;
  currentPage: number;
  pageSize: number;
  tab: "latest" | "all";
};

export function FinancialsTransactionsTable({ bookings, totalCount, currentPage, pageSize, tab }: Props) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const handleTabChange = (newTab: "latest" | "all") => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("tab", newTab);
    params.delete("page");
    router.push(`${pathname}?${params.toString()}`);
  };

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`${pathname}?${params.toString()}`);
  };

  const totalPages = Math.ceil(totalCount / pageSize);

  return (
    <div className="space-y-4">
      <div className="mb-4 flex w-fit gap-1 rounded-xl bg-surface-container-low p-1">
        <button
          onClick={() => handleTabChange("latest")}
          className={`rounded-lg px-6 py-2 text-sm font-bold transition-all ${
            tab === "latest"
              ? "bg-white text-primary shadow-sm ring-1 ring-outline-variant/10"
              : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
          }`}
        >
          الأحدث
        </button>
        <button
          onClick={() => handleTabChange("all")}
          className={`rounded-lg px-6 py-2 text-sm font-bold transition-all ${
            tab === "all"
              ? "bg-white text-primary shadow-sm ring-1 ring-outline-variant/10"
              : "text-on-surface-variant hover:bg-surface-container hover:text-on-surface"
          }`}
        >
          الكل
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-right text-sm">
          <thead>
            <tr className="border-b border-outline-variant/30 text-on-surface-variant text-[11px] font-black uppercase tracking-wider">
              <th className="pb-3 pr-2">رقم الحجز</th>
              <th className="pb-3">العميل</th>
              <th className="pb-3">السيارة</th>
              <th className="pb-3">حالة الدفع</th>
              <th className="pb-3">الطريقة</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-outline-variant/20">
            {bookings.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-6 text-center text-on-surface-variant">
                  لا توجد معاملات
                </td>
              </tr>
            ) : (
              bookings.map((booking) => (
                <tr key={booking.id} className="transition-colors hover:bg-surface-container/30">
                  <td className="py-3 pr-2 font-bold text-primary">
                    <Link href={`/admin/bookings/${booking.id}`}>#{booking.id}</Link>
                  </td>
                  <td className="py-3">{booking.fullName}</td>
                  <td className="py-3">
                    {booking.carModel
                      ? `${booking.carModel.brand.name} ${booking.carModel.name}`
                      : booking.carType}
                  </td>
                  <td className="py-3">
                    <span
                      className={`rounded px-2 py-1 text-[10px] font-black tracking-wide ${
                        booking.paymentStatus === "PAID"
                          ? "bg-emerald-100 text-emerald-800"
                          : booking.paymentStatus === "REFUNDED"
                          ? "bg-rose-100 text-rose-800"
                          : "bg-amber-100 text-amber-800"
                      }`}
                    >
                      {booking.paymentStatus}
                    </span>
                  </td>
                  <td className="py-3 text-[11px] font-black tracking-wide">
                    {booking.paymentStatus === "PENDING" ? (
                      <RegisterBookingPaymentModal bookingId={booking.id} />
                    ) : (
                      booking.paymentMethod || "—"
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-outline-variant/30 pt-4">
          <p className="text-xs text-on-surface-variant">
            عرض {Math.min((currentPage - 1) * pageSize + 1, totalCount)} إلى{" "}
            {Math.min(currentPage * pageSize, totalCount)} من {totalCount} معاملة
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage <= 1}
              className="flex size-8 items-center justify-center rounded-lg border border-outline-variant/40 disabled:opacity-50"
            >
              <ChevronRight className="size-4" />
            </button>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="flex size-8 items-center justify-center rounded-lg border border-outline-variant/40 disabled:opacity-50"
            >
              <ChevronLeft className="size-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
