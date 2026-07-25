import Link from "next/link";
import { requireAdminPagePermission } from "@/lib/admin-page";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import { formatSarAmount } from "@/lib/booking-checkout-pricing";
import { bookingStatusLabelAr } from "@/lib/booking-display-labels";
import { bookingPaymentMethodLabelAr } from "@/lib/booking-payment-method-label";
import { prisma } from "@/lib/prisma";
import {
  getPaymentTransactions,
  getPaymentTransactionsSummary,
  ledgerFiltersFromParams,
  type PaymentTxnDirectionFilter,
} from "@/lib/payment-transaction";

export const dynamic = "force-dynamic";

function fmtDateTime(d: Date): string {
  return d.toLocaleString("ar-SA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** تسمية ولون لكل نوع حركة. */
const KIND_UI: Record<string, { label: string; className: string }> = {
  INITIAL_PAYMENT: { label: "دفعة أولى", className: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200" },
  BALANCE_PAYMENT: { label: "سداد فرق", className: "bg-teal-50 text-teal-700 ring-1 ring-teal-200" },
  LATE_PENALTY: { label: "غرامة تأخير", className: "bg-purple-50 text-purple-700 ring-1 ring-purple-200" },
  REFUND: { label: "استرداد", className: "bg-red-50 text-red-700 ring-1 ring-red-200" },
  REFUND_REVERSAL: { label: "عكس استرداد", className: "bg-sky-50 text-sky-700 ring-1 ring-sky-200" },
  CUSTOMER_SETTLEMENT: { label: "تسوية للعميل", className: "bg-orange-50 text-orange-700 ring-1 ring-orange-200" },
};

function kindUi(kind: string) {
  return KIND_UI[kind] ?? { label: kind, className: "bg-surface-container text-on-surface-variant ring-1 ring-outline-variant/30" };
}

/** من نفّذ الحركة — تسمية عربية. */
const ACTOR_LABEL: Record<string, string> = {
  CUSTOMER: "العميل",
  ADMIN: "موظف",
  GATEWAY: "بوابة الدفع",
  SYSTEM: "النظام",
};

const FILTERS: { key: PaymentTxnDirectionFilter; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "credit", label: "مقبوضات" },
  { key: "debit", label: "مستردات" },
];

type Props = {
  searchParams: Promise<{
    dir?: string;
    period?: string;
    from?: string;
    to?: string;
    branch?: string;
  }>;
};

export default async function LedgerPage({ searchParams }: Props) {
  const session = await requireAdminPagePermission("FINANCIALS");
  const scope = { isSuperAdmin: session.isSuperAdmin, branchId: session.branchId };
  const sp = await searchParams;

  const { filter, from, to, branchId, fromStr, toStr, isToday, isMonth } =
    ledgerFiltersFromParams(sp);
  const filters = { filter, from, to, branchId };

  const branches = scope.isSuperAdmin
    ? await prisma.branch.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
    : [];

  const [summary, items] = await Promise.all([
    getPaymentTransactionsSummary(scope, filters),
    getPaymentTransactions(scope, filters),
  ]);

  // رابط التصدير يحمل نفس الفلاتر المطبَّقة (بالتواريخ الصريحة لمطابقة المعروض).
  const exportParams = new URLSearchParams();
  if (filter !== "all") exportParams.set("dir", filter);
  if (fromStr) exportParams.set("from", fromStr);
  if (toStr) exportParams.set("to", toStr);
  if (branchId != null) exportParams.set("branch", String(branchId));
  const exportQuery = exportParams.toString();
  const exportHref = `/api/admin/ledger/export${exportQuery ? `?${exportQuery}` : ""}`;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="دفتر الحركات المالية"
        description="سجل تفصيلي لكل دفعة واسترداد على الحجوزات — كل عملية سطر مستقل بمبلغها ووسيلتها ومنفّذها. مصدر الحقيقة للتتبع المالي."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          label="إجمالي المقبوضات"
          value={`${formatSarAmount(summary.creditSar)} ر.س`}
          highlight={summary.creditSar > 0}
          hint="الداخل للشركة (دفعات)"
        />
        <AdminStatCard
          label="إجمالي المستردات"
          value={`${formatSarAmount(summary.debitSar)} ر.س`}
          hint="الخارج من الشركة (استرداد/تسوية)"
        />
        <AdminStatCard
          label="الصافي"
          value={`${formatSarAmount(summary.netSar)} ر.س`}
          hint="المقبوضات − المستردات"
        />
        <AdminStatCard
          label="عدد الحركات"
          value={summary.count.toLocaleString("ar-SA")}
          hint="الحركات المكتملة"
        />
      </div>

      <AdminCard
        title="الحركات"
        description="أحدث 200 حركة ضمن نطاقك. المبلغ الأخضر (+) مقبوض للشركة، والأحمر (−) مسترد."
      >
        <form
          method="get"
          action="/admin/ledger"
          className="mb-5 flex flex-wrap items-end gap-3 rounded-2xl border border-outline-variant/25 bg-surface-container-lowest p-4"
        >
          {/* أزرار سريعة */}
          <div className="flex gap-2">
            <button
              type="submit"
              name="period"
              value="today"
              className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${
                isToday
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container text-on-surface-variant ring-1 ring-outline-variant/30 hover:bg-primary-container/30"
              }`}
            >
              اليوم
            </button>
            <button
              type="submit"
              name="period"
              value="month"
              className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${
                isMonth
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container text-on-surface-variant ring-1 ring-outline-variant/30 hover:bg-primary-container/30"
              }`}
            >
              الشهر
            </button>
          </div>

          <label className="flex flex-col gap-1 text-[11px] font-bold text-on-surface-variant">
            من
            <input
              type="date"
              name="from"
              defaultValue={fromStr}
              className="rounded-lg border border-outline-variant/40 bg-white px-3 py-1.5 text-xs text-on-surface outline-none focus:border-primary"
            />
          </label>
          <label className="flex flex-col gap-1 text-[11px] font-bold text-on-surface-variant">
            إلى
            <input
              type="date"
              name="to"
              defaultValue={toStr}
              className="rounded-lg border border-outline-variant/40 bg-white px-3 py-1.5 text-xs text-on-surface outline-none focus:border-primary"
            />
          </label>

          <label className="flex flex-col gap-1 text-[11px] font-bold text-on-surface-variant">
            النوع
            <select
              name="dir"
              defaultValue={filter}
              className="rounded-lg border border-outline-variant/40 bg-white px-3 py-1.5 text-xs text-on-surface outline-none focus:border-primary"
            >
              {FILTERS.map((f) => (
                <option key={f.key} value={f.key}>
                  {f.label}
                </option>
              ))}
            </select>
          </label>

          {scope.isSuperAdmin ? (
            <label className="flex flex-col gap-1 text-[11px] font-bold text-on-surface-variant">
              الفرع
              <select
                name="branch"
                defaultValue={branchId ?? ""}
                className="rounded-lg border border-outline-variant/40 bg-white px-3 py-1.5 text-xs text-on-surface outline-none focus:border-primary"
              >
                <option value="">كل الفروع</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <button
            type="submit"
            className="rounded-lg bg-[#003749] px-4 py-2 text-xs font-extrabold text-white hover:opacity-95"
          >
            تطبيق
          </button>
          <Link
            href="/admin/ledger"
            className="rounded-lg px-3 py-2 text-xs font-bold text-on-surface-variant hover:underline"
          >
            إعادة تعيين
          </Link>
          <a
            href={exportHref}
            className="ms-auto inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-4 py-2 text-xs font-extrabold text-white hover:opacity-95"
          >
            ⬇ تصدير Excel
          </a>
        </form>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b border-outline-variant/30 text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                <th className="pb-3 pr-2">الحجز</th>
                <th className="pb-3">العميل</th>
                <th className="pb-3">النوع</th>
                <th className="pb-3">المبلغ (ر.س)</th>
                <th className="pb-3">الوسيلة</th>
                <th className="pb-3">المنفّذ</th>
                <th className="pb-3">المرجع</th>
                <th className="pb-3">التاريخ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-on-surface-variant">
                    لا توجد حركات في هذا التصنيف حالياً.
                  </td>
                </tr>
              ) : (
                items.map((t) => {
                  const ui = kindUi(t.kind);
                  const isDebit = t.direction === "DEBIT";
                  const ref = t.externalRef || t.gatewayRef || "—";
                  const actor = ACTOR_LABEL[t.actorKind] ?? t.actorKind;
                  return (
                    <tr key={t.id} className="transition-colors hover:bg-surface-container/30">
                      <td className="py-3 pr-2">
                        <Link
                          href={`/admin/bookings/${t.bookingId}`}
                          className="font-bold text-primary hover:underline"
                          dir="ltr"
                        >
                          #{t.bookingId}
                        </Link>
                      </td>
                      <td className="py-3">
                        <div className="font-bold text-on-surface">
                          {t.booking?.fullName ?? "—"}
                        </div>
                        {t.booking?.phone ? (
                          <div className="text-xs text-on-surface-variant" dir="ltr">
                            {t.booking.phone}
                          </div>
                        ) : null}
                      </td>
                      <td className="py-3">
                        <span
                          className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-black ${ui.className}`}
                        >
                          {ui.label}
                        </span>
                        {t.booking ? (
                          <div className="mt-1 text-[10px] text-on-surface-variant">
                            {bookingStatusLabelAr(t.booking.status)}
                          </div>
                        ) : null}
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
                        {fmtDateTime(t.createdAt)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </AdminCard>
    </div>
  );
}
