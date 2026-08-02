import Link from "next/link";
import { AdminCard } from "@/components/admin/AdminCard";
import { AdminPageHeader } from "@/components/admin/AdminPageHeader";
import { AdminStatCard } from "@/components/admin/AdminStatCard";
import { AdminLabelBreakdown } from "@/components/admin/stats/AdminLabelBreakdown";
import { requireAdminPage } from "@/lib/admin-page";
import { adminScope } from "@/lib/admin-scope";
import { getAdminFleetStats } from "@/lib/admin-statistics";

export const dynamic = "force-dynamic";

export default async function AdminStatisticsFleetPage() {
  const session = await requireAdminPage();
  const stats = await getAdminFleetStats(adminScope(session));

  return (
    <>
      <AdminPageHeader
        title="إحصائيات الأسطول"
        description="هيكل المخزون حسب الفئة والعلامة وأكثر الموديلات توفراً — لقطة حالية وليست مرتبطة بفترة زمنية."
        backHref="/admin/statistics"
        backLabel="الإحصائيات"
        actions={
          <Link
            href="/admin/vehicles"
            className="rounded-xl bg-primary px-4 py-2.5 text-sm font-bold text-on-primary shadow-sm transition hover:opacity-95"
          >
            إدارة المركبات
          </Link>
        }
      />

      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <AdminStatCard label="فئات" value={stats.categoriesCount} href="/admin/categories" />
        <AdminStatCard label="علامات" value={stats.brandsCount} />
        <AdminStatCard label="موديلات" value={stats.modelsCount} href="/admin/vehicles" />
        <AdminStatCard label="وحدات متاحة" value={stats.fleetUnits} highlight />
      </div>

      <div className="mb-8 grid gap-4 sm:grid-cols-2">
        <AdminStatCard
          label="موديلات بمخزون"
          value={stats.modelsWithStock}
          hint={`${stats.zeroStockModels} بدون مخزون`}
        />
        <AdminStatCard label="نسبة التغطية" value={`${stats.modelsCount ? Math.round((stats.modelsWithStock / stats.modelsCount) * 100) : 0}%`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <AdminCard title="الوحدات حسب الفئة">
          <AdminLabelBreakdown items={stats.byCategory} accent="#775927" />
        </AdminCard>
        <AdminCard title="الوحدات حسب العلامة">
          <AdminLabelBreakdown items={stats.byBrand} accent="#003749" />
        </AdminCard>
      </div>

      <AdminCard title="أعلى الموديلات بالكمية" className="mt-6">
        <AdminLabelBreakdown items={stats.topModelsByQty} accent="#0f766e" />
      </AdminCard>
    </>
  );
}
