import { Suspense } from "react";
import { Ban, CircleDollarSign, FileX2 } from "lucide-react";
import { CancelledBookingsFilters } from "@/components/admin/CancelledBookingsFilters";
import { CancelledBookingsList } from "@/components/admin/CancelledBookingsList";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { adminBranchDisplayName } from "@/lib/admin-access";
import { loadCancelledBookings } from "@/lib/admin-cancelled-bookings";
import { requireAdminPage } from "@/lib/admin-page";

export const dynamic = "force-dynamic";

const BASE_PATH = "/admin/cancelled-bookings";

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
  icon: typeof Ban;
  accent: string;
}) {
  return (
    <div className="flex gap-4 rounded-2xl border border-outline-variant/25 bg-white p-5 shadow-[0_4px_24px_-10px_rgba(28,27,27,0.1)]">
      <div
        className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${accent}`}
      >
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

export default async function AdminCancelledBookingsPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const session = await requireAdminPage();
  const sp = searchParams ? await searchParams : {};
  const q = sp.q?.trim() || undefined;
  const filter = q ? { q } : {};

  const rows = await loadCancelledBookings(session, filter);

  const withRefund = rows.filter(
    (r) => r.cancellationRefundAmountSar != null && r.cancellationRefundAmountSar > 0,
  ).length;
  const refundTotal = rows.reduce(
    (sum, r) => sum + (r.cancellationRefundAmountSar ?? 0),
    0,
  );

  const branchHint = session.isSuperAdmin
    ? "كل الفروع"
    : `فرع ${adminBranchDisplayName(session)}`;

  return (
    <>
      <AdminPageHeader
        title="الحجوزات الملغاة"
        description={
          <>
            سجل الحجوزات المباشرة الملغاة — مع ملخص الاسترداد والخصم. النطاق: {branchHint}.
          </>
        }
        backHref="/admin"
        backLabel="لوحة التحكم"
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <StatTile
          label="في القائمة"
          value={rows.length}
          hint={q ? "نتائج البحث" : "آخر 200 حجز مباشر ملغى"}
          icon={FileX2}
          accent="bg-[#fef2f2] text-[#b91c1c]"
        />
        <StatTile
          label="باسترداد مالي"
          value={withRefund}
          hint="ضمن النتائج المعروضة"
          icon={CircleDollarSign}
          accent="bg-[#ecfdf5] text-[#047857]"
        />
        <StatTile
          label="مجموع الاسترداد"
          value={
            refundTotal > 0
              ? `${refundTotal.toLocaleString("ar-SA")} ر.س`
              : "—"
          }
          hint="ضمن النتائج المعروضة"
          icon={Ban}
          accent="bg-[#eff6ff] text-[#1d4ed8]"
        />
      </div>

      <div className="mb-8 rounded-2xl border border-outline-variant/25 bg-surface-container-low/50 p-5 sm:p-6">
        <Suspense fallback={<div className="h-12 animate-pulse rounded-xl bg-white/60" />}>
          <CancelledBookingsFilters basePath={BASE_PATH} currentQ={q} />
        </Suspense>
      </div>

      <CancelledBookingsList rows={rows} hasSearch={Boolean(q)} />
    </>
  );
}
