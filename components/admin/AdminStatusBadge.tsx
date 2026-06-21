import { bookingStatusLabelAr, bookingPaymentStatusLabelAr } from "@/lib/booking-display-labels";
import { bookingPaymentMethodLabelAr } from "@/lib/booking-payment-method-label";
const STATUS_STYLES: Record<string, string> = {
  NEW: "bg-[#fff7ed] text-[#9a3412] ring-[#fdba74]/40",
  UNDER_REVIEW: "bg-[#fef3c7] text-[#b45309] ring-[#fcd34d]/50",
  CONTACTED: "bg-[#eff6ff] text-[#1d4ed8] ring-[#93c5fd]/40",
  CONFIRMED: "bg-[#ecfdf5] text-[#047857] ring-[#6ee7b7]/40",
  PICKED_UP: "bg-[#e0f2fe] text-[#0369a1] ring-[#7dd3fc]/50",
  RETURNED: "bg-[#f0fdf4] text-[#15803d] ring-[#86efac]/50",
  CANCELLED: "bg-[#fef2f2] text-[#b91c1c] ring-[#fecaca]/40",
  REJECTED: "bg-surface-container-high text-on-surface-variant ring-outline-variant/35",
  COMPLETED: "bg-surface-container-low text-on-surface-variant ring-outline-variant/30",
};

export function AdminStatusBadge({ status }: { status: string }) {
  const code = status.trim().toUpperCase();
  const style =
    STATUS_STYLES[code] ?? "bg-surface-container-low text-on-surface ring-outline-variant/25";

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${style}`}
    >
      {bookingStatusLabelAr(code)}
    </span>
  );
}

export function AdminKindBadge({ kind }: { kind: string }) {
  const isDirect = kind === "DIRECT";
  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${
        isDirect
          ? "bg-[#ecfdf5] text-[#047857] ring-[#6ee7b7]/40"
          : "bg-[#f5f3ff] text-[#6d28d9] ring-[#c4b5fd]/40"
      }`}
    >
      {isDirect ? "حجز مباشر" : "استفسار"}
    </span>
  );
}

export function AdminPaymentBadge({
  paymentStatus,
  paymentMethod,
  balanceDueAtBranchSar,
}: {
  paymentStatus: string | null;
  paymentMethod: string | null;
  balanceDueAtBranchSar?: number | null;
}) {
  const code = (paymentStatus || "PENDING").trim().toUpperCase();
  const isPartiallyPaid = code === "PAID" && (balanceDueAtBranchSar ?? 0) > 0;
  
  const style =
    isPartiallyPaid
      ? "bg-[#fef3c7] text-[#b45309] ring-[#fcd34d]/50" // Amber/Yellow style for partial
      : code === "PAID"
      ? "bg-[#ecfdf5] text-[#047857] ring-[#6ee7b7]/40"
      : code === "REFUNDED" || code === "PARTIAL_REFUND"
      ? "bg-[#fef2f2] text-[#b91c1c] ring-[#fecaca]/40"
      : "bg-[#fff7ed] text-[#9a3412] ring-[#fdba74]/40";

  const methodLabel = paymentMethod ? bookingPaymentMethodLabelAr(paymentMethod) : null;
  const statusLabel = isPartiallyPaid ? "مدفوع جزئياً" : bookingPaymentStatusLabelAr(code);

  return (
    <span
      className={`inline-flex rounded-full px-2.5 py-0.5 text-[11px] font-bold ring-1 ring-inset ${style}`}
    >
      {statusLabel}
      {methodLabel ? ` · ${methodLabel}` : ""}
    </span>
  );
}
