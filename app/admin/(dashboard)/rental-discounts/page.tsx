import Link from "next/link";
import { RentalDiscountCreateForm } from "@/app/admin/(dashboard)/rental-discounts/RentalDiscountCreateForm";
import { RentalDiscountDeleteForm } from "@/app/admin/(dashboard)/rental-discounts/RentalDiscountDeleteForm";
import { requireAdminPage } from "@/lib/admin-page";
import { adminScope } from "@/lib/admin-scope";
import { getBrandsForAdminSelect } from "@/lib/brand-data";
import {
  getBranchesForDiscountSelect,
  getCarModelsForDiscountSelect,
  getRentalDiscountsForAdmin,
} from "@/lib/rental-discount-admin-data";

export const dynamic = "force-dynamic";

function formatScope(row: {
  brandName: string | null;
  carModelLabel: string | null;
  branchName: string | null;
  startsAt: Date | null;
  endsAt: Date | null;
}): string {
  const parts: string[] = [];
  if (row.carModelLabel) parts.push(`موديل: ${row.carModelLabel}`);
  else if (row.brandName) parts.push(`ماركة: ${row.brandName}`);
  else parts.push("كل المركبات");

  if (row.branchName) parts.push(`فرع: ${row.branchName}`);
  else parts.push("كل الفروع");

  if (row.startsAt || row.endsAt) {
    const from = row.startsAt ? row.startsAt.toISOString().slice(0, 10) : "—";
    const to = row.endsAt ? row.endsAt.toISOString().slice(0, 10) : "—";
    parts.push(`فترة: ${from} → ${to}`);
  } else {
    parts.push("بدون تقييد زمني");
  }
  return parts.join(" · ");
}

function formatValue(kind: string, value: number): string {
  return kind === "PERCENT" ? `${value}%` : `${value} ر.س/يوم`;
}

export default async function AdminRentalDiscountsPage() {
  const scope = adminScope(await requireAdminPage());

  const [discounts, brands, models, branches] = await Promise.all([
    getRentalDiscountsForAdmin(scope),
    getBrandsForAdminSelect(),
    getCarModelsForDiscountSelect(),
    getBranchesForDiscountSelect(scope),
  ]);

  return (
    <div className="mx-auto max-w-5xl">
      <header className="mb-10">
        <Link href="/admin" className="mb-3 inline-block text-sm font-bold text-primary hover:underline">
          ← لوحة التحكم
        </Link>
        <h1 className="text-3xl font-extrabold tracking-tight">خصومات التأجير</h1>
        <p className="mt-2 text-on-surface-variant">
          تحكّم في خصومات الأسعار اليومية حسب الفترة، الماركة/الموديل، أو الفرع. العميل يرى السعر
          المخفّض فقط مع عبارة «خصم X٪» أو «وفّرت X ر.س» دون تفاصيل الشروط.
        </p>
      </header>

      <RentalDiscountCreateForm brands={brands} models={models} branches={branches} />

      <div className="overflow-x-auto rounded-2xl border border-outline-variant/30 bg-surface-container-low">
        <table className="w-full min-w-[880px] text-start text-sm">
          <thead>
            <tr className="border-b border-outline-variant/40 bg-surface-container/80">
              <th className="px-4 py-3 font-bold">الاسم الداخلي</th>
              <th className="px-4 py-3 font-bold">الخصم</th>
              <th className="px-4 py-3 font-bold">الشروط (إدارة فقط)</th>
              <th className="px-4 py-3 font-bold">حالة</th>
              <th className="px-4 py-3 font-bold">إجراءات</th>
            </tr>
          </thead>
          <tbody>
            {discounts.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-on-surface-variant">
                  لا توجد خصومات بعد.
                </td>
              </tr>
            ) : (
              discounts.map((d) => (
                <tr key={d.id} className="border-b border-outline-variant/20 last:border-0">
                  <td className="px-4 py-3 font-medium">{d.labelAr}</td>
                  <td className="px-4 py-3 tabular-nums" dir="ltr">
                    {formatValue(d.kind, d.value)}
                  </td>
                  <td className="max-w-xs px-4 py-3 text-xs text-on-surface-variant">
                    {formatScope(d)}
                  </td>
                  <td className="px-4 py-3">
                    {d.isActive ? (
                      <span className="rounded-full bg-primary-container/50 px-2 py-0.5 text-xs font-bold text-on-primary-container">
                        نشط
                      </span>
                    ) : (
                      <span className="rounded-full bg-outline-variant/40 px-2 py-0.5 text-xs font-bold text-on-surface-variant">
                        معطّل
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <Link
                        href={`/admin/rental-discounts/${d.id}/edit`}
                        className="rounded-lg border border-outline-variant px-3 py-1.5 text-xs font-bold text-primary hover:bg-surface-container"
                      >
                        تعديل
                      </Link>
                      <RentalDiscountDeleteForm id={d.id} labelAr={d.labelAr} />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
