import Link from "next/link";
import { requireAdminPagePermission } from "@/lib/admin-page";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import { formatSar } from "@/lib/admin-statistics";
import { bookingStatusLabelAr } from "@/lib/booking-display-labels";
import {
  getCompanyDuesPosition,
  getCompanyReceivables,
  type CompanyReceivableCategory,
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

const CATEGORY_UI: Record<
  CompanyReceivableCategory,
  { label: string; className: string }
> = {
  UNPAID_BOOKING: {
    label: "حجز غير مدفوع",
    className: "bg-red-50 text-red-700 ring-1 ring-red-200",
  },
  MODIFICATION_BALANCE: {
    label: "فرق تعديل/تمديد",
    className: "bg-amber-50 text-amber-800 ring-1 ring-amber-200",
  },
};

/** رسوم إضافية تُصبّ في نفس رصيد الفرع، فالتسمية تتبع مصدر المبلغ لا الفئة وحدها. */
const EXTRA_CHARGES_UI = {
  label: "رسوم إضافية",
  className: "bg-orange-50 text-orange-800 ring-1 ring-orange-200",
};
const MIXED_BALANCE_UI = {
  label: "رسوم إضافية + فرق تعديل",
  className: "bg-orange-50 text-orange-800 ring-1 ring-orange-200",
};

function categoryUiFor(
  category: CompanyReceivableCategory,
  dueSar: number,
  extraChargesDueSar: number,
) {
  if (category !== "MODIFICATION_BALANCE" || extraChargesDueSar <= 0) {
    return CATEGORY_UI[category];
  }
  // فرق الهللة لا يجعل الرصيد «مختلطاً».
  return dueSar - extraChargesDueSar > 0.01 ? MIXED_BALANCE_UI : EXTRA_CHARGES_UI;
}

type FilterKey = "all" | "unpaid" | "balance";

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: "all", label: "الكل" },
  { key: "unpaid", label: "حجوزات غير مدفوعة" },
  { key: "balance", label: "فروق تعديل/تمديد" },
];

function parseFilter(raw: string | undefined): FilterKey {
  return raw === "unpaid" || raw === "balance" ? raw : "all";
}

type Props = { searchParams: Promise<{ type?: string }> };

export default async function CompanyDuesPage({ searchParams }: Props) {
  const session = await requireAdminPagePermission("FINANCIALS");
  const scope = { isSuperAdmin: session.isSuperAdmin, branchId: session.branchId };
  const sp = await searchParams;
  const filter = parseFilter(sp.type);

  const [position, allItems] = await Promise.all([
    getCompanyDuesPosition(scope),
    getCompanyReceivables(scope),
  ]);

  const items =
    filter === "unpaid"
      ? allItems.filter((i) => i.category === "UNPAID_BOOKING")
      : filter === "balance"
        ? allItems.filter((i) => i.category === "MODIFICATION_BALANCE")
        : allItems;

  return (
    <div className="space-y-8">
      <AdminPageHeader
        title="مستحقات للشركة"
        description="كل الحجوزات التي عليها مبالغ للشركة: حجوزات قائمة لم تُدفع بعد، وأرصدة على حجوزات مدفوعة (فروق تمديد/تعديل وغرامات تأخير) — مرتّبة بالأخطر أولاً."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <AdminStatCard
          label="إجمالي مستحقات للشركة"
          value={`${formatSar(position.receivables.totalSar)} ر.س`}
          highlight={position.receivables.totalSar > 0}
          hint={`${position.receivables.count} حجزاً — الصافي بعد مستحقات العملاء ${formatSar(position.netSar)} ر.س`}
        />
        <AdminStatCard
          label="حجوزات غير مدفوعة"
          value={`${formatSar(position.unpaidBookings.totalSar)} ر.س`}
          hint={`${position.unpaidBookings.count} حجزاً قائماً بلا دفع`}
        />
        <AdminStatCard
          label="فروق تعديل/تمديد"
          value={`${formatSar(position.modificationBalances.totalSar)} ر.س`}
          hint={`${position.modificationBalances.count} حجزاً مدفوعاً عليه رصيد`}
        />
        <AdminStatCard
          label="مستحقات على الشركة"
          value={`${formatSar(position.payables.totalSar)} ر.س`}
          href="/admin/customer-dues"
          hint={`${position.payables.count} حجز — للعملاء`}
        />
      </div>

      <AdminCard
        title="الحجوزات المستحقة"
        description="«حجز غير مدفوع» = إجمالي الحجز كاملاً لم يُسدَّد؛ «فرق تعديل/تمديد» = رصيد متبقٍ على حجز مدفوع يُحصَّل عند الفرع."
      >
        <div className="mb-5 flex flex-wrap gap-2">
          {FILTERS.map((f) => {
            const active = filter === f.key;
            const count =
              f.key === "all"
                ? allItems.length
                : f.key === "unpaid"
                  ? position.unpaidBookings.count
                  : position.modificationBalances.count;
            return (
              <Link
                key={f.key}
                href={f.key === "all" ? "/admin/company-dues" : `/admin/company-dues?type=${f.key}`}
                className={`rounded-full px-4 py-2 text-xs font-bold transition-colors ${
                  active
                    ? "bg-primary text-on-primary"
                    : "bg-surface-container text-on-surface-variant ring-1 ring-outline-variant/30 hover:bg-primary-container/30"
                }`}
              >
                {f.label}
                <span className="mr-1.5 tabular-nums opacity-75">({count})</span>
              </Link>
            );
          })}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b border-outline-variant/30 text-[11px] font-black uppercase tracking-wider text-on-surface-variant">
                <th className="pb-3 pr-2">الحجز</th>
                <th className="pb-3">العميل</th>
                <th className="pb-3">السيارة</th>
                <th className="pb-3">التصنيف</th>
                <th className="pb-3">حالة الحجز</th>
                <th className="pb-3">المستحق (ر.س)</th>
                <th className="pb-3">تاريخ الاستلام</th>
                <th className="pb-3">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-outline-variant/20">
              {items.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-on-surface-variant">
                    لا توجد مستحقات في هذا التصنيف حالياً.
                  </td>
                </tr>
              ) : (
                items.map(({ booking: b, category, dueSar, hasDelayPenalty, extraChargesDueSar }) => {
                  const cat = categoryUiFor(category, dueSar, extraChargesDueSar);
                  const statusUpper = b.status.trim().toUpperCase();
                  const serviceStarted = ["RETURNED", "COMPLETED", "PICKED_UP"].includes(
                    statusUpper,
                  );
                  return (
                    <tr
                      key={`${category}-${b.id}`}
                      className="transition-colors hover:bg-surface-container/30"
                    >
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
                      <td className="py-3">
                        <span
                          className={`inline-block whitespace-nowrap rounded-full px-2.5 py-1 text-[11px] font-black ${cat.className}`}
                        >
                          {cat.label}
                        </span>
                        {hasDelayPenalty ? (
                          <span className="mt-1 block w-fit whitespace-nowrap rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-bold text-purple-700 ring-1 ring-purple-200">
                            تشمل غرامة تأخير
                          </span>
                        ) : null}
                      </td>
                      <td className="py-3 text-xs font-bold">
                        <span className={serviceStarted ? "text-error" : "text-on-surface"}>
                          {bookingStatusLabelAr(b.status)}
                        </span>
                      </td>
                      <td className="py-3 font-extrabold text-amber-800 tabular-nums" dir="ltr">
                        {formatSar(dueSar)}
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
